# 포천아트밸리 천문과학관 포토 모자이크 시스템 계획서 v2

> 비용 제로 · 로컬 PC 독립 구동 · Cloudflare 임시 터널 · 컬러 완전 보존

---

## 1. 시스템 구조

```
관람객 폰 (LTE/5G)
    ↓ QR 스캔 (매일 자동 갱신)
https://xxxx.trycloudflare.com/upload.html
    ↓ 사진 POST (multipart)
Node.js 서버 (localhost:3000)
    ├── multer       → /uploads/ 저장 + 리사이징
    ├── 슬롯 배정    → database.json 업데이트
    └── Socket.io    → 브로드캐스트
            ↓                    ↓
    모니터 1                모니터 2
    guide.html              display.html
    (QR + 안내)             (Canvas 모자이크)
```

---

## 2. 확정 스펙

| 항목 | 값 |
|---|---|
| 격자 | 7×4 (28칸, 활성 슬롯은 mask 기준) |
| 화면 | 1920×1080 |
| 칸 크기 | 비율값 기준 (절대 픽셀 아님) |
| 슬롯 정책 | 28칸 채우면 마감 (FIFO 롤링 없음) |
| 초기 상태 | 빈 칸 = 어두운 단색 (placeholder 없음) |
| 사진 색상 | 100% 원색 보존 |
| 터널 | trycloudflare 임시 (매일 URL 변경) |
| QR 갱신 | 서버가 URL 파싱 → Socket → guide.html 자동 갱신 |
| 리셋 | 서버 시작 시 날짜 확인 → 자동 초기화 |

---

## 3. 에셋 구성 (3개)

```
/public/
├── bg.jpg              ← 우주/성운 배경 이미지
├── target_mask.png     ← 망원경 실루엣 마스크
│                          흰색=내부(사진 보임)
│                          검정/투명=외부(사진 숨김)
└── target_outline.png  ← 망원경 윤곽선만
                           얇은 선, 알파채널 PNG
                           맨 위에 올려서 경계 강조
```

### target_mask.png 제작 방법

```
1. 망원경 실사진 가져오기
2. 배경 제거 (remove.bg 또는 포토샵)
3. 내부 흰색으로 채우기
4. PNG 저장 (알파채널 보존)
```

### target_outline.png 제작 방법

```
target_mask.png에서
포토샵 → 레이어 스타일 → 외부 획(Stroke) 추출
또는 Canny Edge Detection으로 윤곽선만 추출
PNG 저장
```

---

## 4. Canvas 4레이어 렌더 파이프라인

```
Layer 4 (최상단)
target_outline.png
globalCompositeOperation: 'source-over'
globalAlpha: 0.85
→ 망원경 윤곽선 강조, 사진 색 건드리지 않음
──────────────────────────────────────────
Layer 3
target_mask.png
globalCompositeOperation: 'destination-in'
→ 마스크 바깥 사진 픽셀 제거
   (망원경 실루엣 안에만 사진 보임)
──────────────────────────────────────────
Layer 2
방문객 사진 타일 (28개 슬롯)
globalCompositeOperation: 'source-over'
globalAlpha: 1.0
→ 원색 100% 보존
──────────────────────────────────────────
Layer 1 (최하단)
bg.jpg 우주 배경
globalCompositeOperation: 'source-over'
→ 빈 슬롯 뒤로 보임
```

### 렌더 코드 흐름

```javascript
function render() {
    const W = canvas.width, H = canvas.height

    // Layer 1: 배경
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1.0
    ctx.drawImage(bgImg, 0, 0, W, H)

    // Layer 2: 방문객 사진 타일 (원색 보존)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1.0
    tiles.forEach((tile, i) => {
        if (queue[i]) {
            const px = tile.x * W, py = tile.y * H
            const pw = tile.w * W, ph = tile.h * H
            ctx.drawImage(queue[i], px, py, pw, ph)
        } else {
            // 빈 슬롯: 어두운 단색
            ctx.fillStyle = '#0a0a1a'
            ctx.fillRect(tile.x*W, tile.y*H, tile.w*W, tile.h*H)
        }
    })

    // Layer 3: 마스크 클리핑 (망원경 바깥 제거)
    ctx.globalCompositeOperation = 'destination-in'
    ctx.globalAlpha = 1.0
    ctx.drawImage(maskImg, 0, 0, W, H)

    // Layer 4: 윤곽선 오버레이
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 0.85
    ctx.drawImage(outlineImg, 0, 0, W, H)
}
```

---

## 5. config.js 구조

```javascript
const CONFIG = {
    canvas: { width: 1920, height: 1080 },

    assets: {
        bg:      'bg.jpg',
        mask:    'target_mask.png',
        outline: 'target_outline.png'
    },

    // 7×4 격자, 비율값 (실제px = x * canvas.width)
    // active: false 인 칸은 슬롯 등록 안 됨
    grid: [
        // row 0
        { id: 0,  row: 0, col: 0, x: 0.00, y: 0.00, w: 0.143, h: 0.25, active: false },
        { id: 1,  row: 0, col: 1, x: 0.143,y: 0.00, w: 0.143, h: 0.25, active: false },
        { id: 2,  row: 0, col: 2, x: 0.286,y: 0.00, w: 0.143, h: 0.25, active: true  },
        { id: 3,  row: 0, col: 3, x: 0.429,y: 0.00, w: 0.143, h: 0.25, active: true  },
        { id: 4,  row: 0, col: 4, x: 0.572,y: 0.00, w: 0.143, h: 0.25, active: true  },
        { id: 5,  row: 0, col: 5, x: 0.715,y: 0.00, w: 0.143, h: 0.25, active: false },
        { id: 6,  row: 0, col: 6, x: 0.858,y: 0.00, w: 0.143, h: 0.25, active: false },
        // row 1~3 동일 패턴...
        // target_mask.png 받은 후 좌표 자동 추출 스크립트로 확정
    ],

    blend: {
        outline_alpha: 0.85   // 윤곽선 투명도 조절
    },

    server: {
        port: 3000,
        thumbnail_size: 600,
        backup_keep_days: 7
    }
}
```

---

## 6. 파일 구조

```
C:\museum-mosaic\
├── server.js               # Express + multer + Socket.io
├── config.js               # 격자·에셋·서버 설정
├── database.json           # 슬롯 상태 (자동 생성)
├── start.bat               # 원터치 실행
├── extract_coords.js       # 마스크 PNG → 좌표 자동 추출 스크립트
├── /public/
│   ├── upload.html         # 관람객 업로드 (폰)
│   ├── guide.html          # 모니터 1 (QR + 안내)
│   ├── display.html        # 모니터 2 (Canvas 모자이크)
│   ├── bg.jpg              # 우주 배경
│   ├── target_mask.png     # 망원경 마스크 (흰=내부)
│   └── target_outline.png  # 망원경 윤곽선
└── /uploads/
    └── /backup/            # 날짜별 압축 백업
```

---

## 7. start.bat 실행 순서

```bat
@echo off
cd C:\museum-mosaic

:: 1. Node.js 서버 시작
start cmd /k node server.js

:: 2. 잠시 대기
timeout /t 2

:: 3. Cloudflare 터널 (서버가 로그 감시 → URL 파싱 → Socket 브로드캐스트)
start cmd /k cloudflared tunnel --url http://localhost:3000

:: 4. URL 확정 대기 (터널 로그 뜨는 시간)
timeout /t 6

:: 5. 크롬 2개 실행
start chrome --kiosk http://localhost:3000/guide.html
start chrome --kiosk http://localhost:3000/display.html
```

---

## 8. 하루 운영 흐름

```
아침 (start.bat)
├── 서버 시작 → 날짜 확인
│   └── 날짜 다르면: uploads/ 압축 백업 → DB 초기화
├── cloudflared 터널 → URL 파싱
├── guide.html QR 자동 갱신 (Socket)
└── 크롬 2개 자동 실행

낮 (관람객 참여)
├── QR 스캔 → upload.html
├── 사진 선택 → 업로드
├── 서버: 리사이징 → 슬롯 배정 → DB 저장
├── Socket → display.html 해당 칸 애니메이션
│           guide.html 카운터 +1
└── 폰 화면: 완료 + 업로드한 사진 + 슬롯 위치

저녁
└── PC 그대로 or 종료
    다음날 start.bat → 자동 리셋
```

---

## 9. 업로드 완료 화면 (upload.html)

```
┌─────────────────────┐
│   내 사진이         │
│   올라갔어요! ✓     │
│                     │
│  [업로드한 사진]    │  ← 썸네일 표시
│                     │
│  로비 화면          │
│  2행 3열 에         │  ← 슬롯 위치 안내
│  올라갔어요 🔭      │
│                     │
│  저 화면에서        │
│  확인해보세요!      │
└─────────────────────┘
```

직원 보상 확인: 폰 완료 화면 + display.html 육안 일치 확인

---

## 10. display.html 화면 구성

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│     [bg.jpg — 우주/성운 배경 전체]                   │
│                                                      │
│         [Layer 2: 방문객 사진 타일]                  │
│         [Layer 3: target_mask 클리핑]                │
│         → 망원경 모양으로 잘린 사진들                │
│                                                      │
│         [Layer 4: target_outline 윤곽선]             │
│         → 망원경 경계선 강조                         │
│                                                      │
│   X / 22명 참여    (우하단 또는 좌상단 텍스트)       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 11. guide.html 화면 구성 (모니터 1)

```
┌──────────────────────────────────────┐
│  🔭 포천아트밸리 천문과학관          │
│                                      │
│  오늘의 우주를 함께 만들어요         │
│                                      │
│  STEP 1. 아트밸리에서 사진 찍기     │
│  STEP 2. 아래 QR 스캔               │
│  STEP 3. 사진 업로드                │
│  STEP 4. 오른쪽 화면에서 확인       │
│                                      │
│  ┌────────────┐                      │
│  │  QR코드    │  ← Socket로 자동 갱신│
│  │ (매일 변경)│                      │
│  └────────────┘                      │
│                                      │
│     오늘 X / 22명 참여중             │
└──────────────────────────────────────┘
```

---

## 12. 남은 준비 에셋

| 에셋 | 담당 | 시점 |
|---|---|---|
| target_mask.png | 주언씨 제공 | 코드 전에 |
| target_outline.png | 주언씨 제공 or 자동 추출 | 마스크 후 |
| bg.jpg | 주언씨 제공 | 코드 전에 |
| config.js 좌표 | 마스크 픽셀 분석 자동 추출 | 마스크 받은 후 |

---

## 13. 개발 순서

| 단계 | 작업 |
|---|---|
| A | server.js (Express + multer + Socket.io + 터널 URL 파싱) |
| B | database.json 슬롯 관리 + 날짜 리셋 |
| C | extract_coords.js (mask PNG → config 좌표 자동 추출) |
| D | upload.html (업로드 + 완료 화면) |
| E | display.html (4레이어 Canvas 파이프라인) |
| F | guide.html (QR 자동 갱신 + 카운터) |
| G | start.bat 자동화 |
| H | 현장 테스트 |
