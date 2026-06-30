# 🔭 포천아트밸리 천문과학관 포토 모자이크 시스템

본 프로젝트는 포천아트밸리 천문과학관에서 사용되는 **비용 제로, 로컬 PC 독립 구동형 포토 모자이크 전시 시스템**입니다. 관람객이 모바일 기기로 QR 코드를 스캔해 업로드한 사진들을 실시간으로 분석 및 썸네일화하여, 전시장 내 대형 모니터(1920×1080)에 망원경 모양의 모자이크 타일로 렌더링합니다.

---

## 1. 시스템 구조 및 동작 원리

```
관람객 폰 (LTE/5G)
     ↓ QR 스캔 (매일 자동 갱신되는 임시 URL)
https://xxxx.trycloudflare.com/upload.html
     ↓ 사진 업로드 (POST, multipart)
Node.js 서버 (localhost:3000)
     ├── multer       → /uploads/ 저장 및 이미지 리사이징(sharp)
     ├── 슬롯 배정    → database.json 업데이트 (사용 가능한 활성 슬롯에 랜덤 배치)
     └── Socket.io    → 브로드캐스트 전송
             │
             ├──────────────────────────┐
             ▼                          ▼
     모니터 1 (안내기)           모니터 2 (전시기)
     guide.html                  display.html
     - 접속용 QR 코드 자동 표시  - 4레이어 Canvas 모자이크 렌더링
     - 참여자 현황 카운터        - 사진 업로드 시 실시간 등장 애니메이션
```

---

## 2. 파일 및 디렉토리 구조

```
C:\Users\Buvi\Desktop\project\mosaic\ (또는 구동 폴더)
├── server.js               # Express 웹 서버, 이미지 업로드/축소 처리 및 Socket.io 이벤트, Cloudflare 터널 구동
├── config.js               # 격자(Grid) 배치 좌표, 포트, 에셋 경로 및 기본 설정값
├── database.json           # [자동생성] 당일의 슬롯 배치 현황 데이터베이스
├── start.bat               # 원터치 시스템 기동 배치 파일
├── extract_coords.js       # 마스크 PNG 파일을 분석하여 활성 슬롯 좌표를 자동 추출해주는 도구
├── package.json            # Node.js 패키지 의존성 파일
├── /public/                # 정적 웹페이지 및 전시에 필요한 이미지 에셋
│   ├── upload.html         # 관람객 모바일 사진 선택 및 업로드 화면
│   ├── guide.html          # 안내 모니터 화면 (접속 QR 코드 실시간 표시)
│   ├── display.html        # 전시 모니터 화면 (포토 모자이크 캔버스)
│   ├── bg.jpg              # 우주/성운 배경 이미지
│   ├── target_mask.png     # 망원경 실루엣 마스크 (흰색=사진 표시, 검은색/투명=숨김)
│   └── target_outline.png  # 망원경 윤곽선 레이어 (선 두께 강조용)
└── /uploads/               # 업로드된 썸네일(600px) 보관 폴더
    └── /backup/            # 날짜별로 압축 백업된 zip 파일 보관 폴더
```

---

## 3. 사전 요구 사항 (Prerequisites)

시스템을 실행하기 전에 로컬 PC에 다음 프로그램들이 설치되어 있어야 합니다:

1. **Node.js** (LTS 버전 권장, v18+)
2. **구글 크롬(Chrome) 브라우저** (전시용 Kiosk 모드 구동용)

*※ Cloudflare 터널링용 실행 파일(`cloudflared.exe`)은 프로젝트 폴더 내부에 로컬로 내장(51.6MB)되어 제공되므로, 별도로 설치하거나 환경 변수 설정을 진행하지 않으셔도 됩니다.*

---

## 4. 설치 및 초기 설정

### 4.1 의존성 패키지 설치
프로젝트 루트 디렉토리에서 터미널을 열고 다음 명령어를 실행하여 필요한 패키지를 설치합니다:
```bash
npm install
```
*(주요 설치 모듈: `express`, `socket.io`, `multer`, `sharp`, `archiver`)*

### 4.2 필수 전시 에셋 준비
`public/` 디렉토리 내에 아래 규격의 에셋 3종이 위치해야 구동됩니다:
- **`bg.jpg`**: 1920×1080 해상도의 전시장 배경 우주/성운 이미지.
- **`target_mask.png`**: 흰색 영역(망원경 내부)에만 사진이 들어가고, 검정/투명 영역(바깥쪽)은 사진을 잘라내는 마스크 PNG 이미지.
- **`target_outline.png`**: 잘린 경계선을 매끄럽고 고급스럽게 가려줄 망원경 윤곽선 강조용 PNG 이미지.

### 4.3 격자 좌표 자동 추출 및 설정
망원경 마스크 파일(`target_mask.png`)이 변경되면, 전시판 격자(7×4 총 28칸) 중 어느 위치가 활성화(흰색 부분)될지 추출해야 합니다:
1. 에셋을 `public/` 폴더에 넣습니다.
2. 아래 스크립트를 실행합니다:
   ```bash
   node extract_coords.js
   ```
3. 콘솔 창에 출력된 `grid: [ ... ]` 배열 코드를 복사합니다.
4. [config.js](file:///c:/Users/Buvi/Desktop/project/mosaic/config.js) 파일의 `grid` 항목 부분에 덮어씁니다.

---

## 5. 실행 방법

시스템을 한 번에 실행하기 위해 프로젝트 루트에 있는 **`start.bat`** 파일을 더블 클릭하여 실행합니다.

`start.bat`은 내부적으로 상대 경로(`"%~dp0"`)로 작동하며, `server.js` 기동 시 폴더 내의 `cloudflared.exe`를 감지해 자동으로 터널을 연동합니다. 별도의 중복 터널 창 없이 안전하게 구동됩니다.

---

## 6. 운영 시나리오 및 기능 설명

### 6.1 일일 자동 초기화 및 백업
- 매일 아침 컴퓨터를 켜고 `start.bat`을 실행하면, 서버가 어제의 `database.json` 날짜와 비교합니다.
- 날짜가 다를 경우:
  1. `/uploads/` 폴더 내부의 기존 썸네일 이미지들을 어제 날짜 파일명(예: `2026-06-25.zip`)으로 압축하여 `/uploads/backup/` 폴더로 자동 백업합니다.
  2. 업로드 폴더 내의 이전 이미지들을 모두 삭제(비우기)합니다.
  3. `database.json`을 오늘 날짜의 빈 격자 판 상태로 자동 리셋합니다.
  4. 보관 주기 설정(`CONFIG.server.backup_keep_days` - 기본값 7일)이 만료된 오래된 백업 zip 파일은 자동으로 영구 삭제합니다.

### 6.2 Cloudflare 임시 터널 자동 연동
- 서버가 실행되면서 `cloudflared`를 실행하여 무작위 서브도메인의 `trycloudflare.com` 주소를 발급받습니다.
- 서버가 터널 로그에서 주소(예: `https://xxxx.trycloudflare.com`)를 자동으로 파싱하여 감지합니다.
- 웹소켓(Socket.io)을 통해 로비 안내 모니터(`guide.html`)에 새 URL을 전달하고, 안내 모니터는 이에 맞춰 QR 코드를 자동으로 실시간 갱신합니다.
- 관람객이 스마트폰으로 이 QR을 찍고 자신의 사진을 업로드합니다.

### 6.3 사진 타일 렌더링 파이프라인 (display.html Canvas)
전시 모니터는 하드웨어 성능과 렌더링 품질을 고려하여 HTML5 Canvas를 활용한 4레이어 렌더링을 수행합니다:
1. **Layer 1 (최하단)**: `bg.jpg` 우주 배경 전체 그리기.
2. **Layer 2 (중간 타일)**: 7×4 격자 좌표 중 활성 슬롯에 맞춰 사진 타일들을 그립니다. 빈 곳은 지정된 어두운 단색(`#0a0a1a`)으로 메워집니다.
3. **Layer 3 (클리핑)**: `'destination-in'` 기법을 이용해 `target_mask.png`로 캔버스 전체를 마스킹하여 망원경 형태 내부 영역만 사진을 남기고 외곽의 사각형 형태 픽셀은 투명하게 오려냅니다.
4. **Layer 4 (최상단)**: `'source-over'` 모드로 `target_outline.png`를 살짝 얹어 망원경 외곽선과 경계를 뚜렷하게 부각시킵니다. 이 방식은 사진의 원색 색상을 왜곡 없이 100% 보존합니다.

---

## 7. 주요 설정 변경 (`config.js`)

[config.js](file:///c:/Users/Buvi/Desktop/project/mosaic/config.js) 파일을 수정하여 세부 동작을 변경할 수 있습니다:
- **`canvas`**: 전시장 모니터의 해상도 규격을 설정합니다 (기본 `1920` × `1080`).
- **`server.thumbnail_size`**: 방문객이 업로드한 원본 사진을 가로/세로 최대 몇 픽셀로 압축 저장할지 지정합니다 (기본 `600`px). 모바일 데이터 절약과 로컬 로딩 효율 향상을 위해 리사이징합니다.
- **`server.backup_keep_days`**: 보관할 백업 zip 파일의 기한을 설정합니다 (기본 `7`일).

---

## 8. 모니터 분할/크롬 키오스크 설정 참고 (팁)
듀얼 모니터 구성 시, 두 크롬 창을 각각의 모니터(1번 안내, 2번 전시) 화면에 전체화면(`--kiosk`)으로 띄우려면 `start.bat` 파일 내 크롬 기동 명령어 뒤에 모니터 오프셋 값(`--window-position=X,Y`)을 추가로 넣어 조율할 수 있습니다.
- 예: 1번 모니터가 1920px 너비인 경우, 2번 모니터용 크롬 명령에 `--window-position=1920,0` 부여
- 예시:
  ```bat
  start chrome --kiosk --app=http://localhost:3000/guide.html --window-position=0,0
  start chrome --kiosk --app=http://localhost:3000/display.html --window-position=1920,0
  ```

---

## 9. 참고 자료 및 레퍼런스 (References)

프로젝트 기획 및 개발 과정에서 참고하고 활용한 주요 오픈소스와 디자인 가이드라인 링크입니다:

### ⚙️ Backend & Tunneling
- **Node.js**: [https://nodejs.org](https://nodejs.org)
- **Express.js**: [https://github.com/expressjs/express](https://github.com/expressjs/express)
- **Socket.io**: [https://github.com/socketio/socket.io](https://github.com/socketio/socket.io)
- **Sharp (이미지 리사이즈 및 서버사이드 조각 블렌딩)**: [https://github.com/lovell/sharp](https://github.com/lovell/sharp)
- **Multer (Multipart 파일 업로드)**: [https://github.com/expressjs/multer](https://github.com/expressjs/multer)
- **Cloudflare Tunnel (cloudflared)**: [https://github.com/cloudflare/cloudflared](https://github.com/cloudflare/cloudflared)

### 🎨 Frontend & Design System
- **Tailwind CSS (UI 스타일링)**: [https://tailwindcss.com](https://tailwindcss.com) / [https://github.com/tailwindlabs/tailwindcss](https://github.com/tailwindlabs/tailwindcss)
- **Material Design 3 (M3) 가이드라인**: [https://m3.material.io](https://m3.material.io)
- **Google Material Symbols (아이콘)**: [https://fonts.google.com/icons](https://fonts.google.com/icons)
- **node-qrcode (QR 생성 캔버스 라이브러리)**: [https://github.com/soldair/node-qrcode](https://github.com/soldair/node-qrcode)

### 📚 핵심 모자이크 알고리즘 레퍼런스 (기획 참고)
- **sausheong/mosaic** ([https://github.com/sausheong/mosaic](https://github.com/sausheong/mosaic)): 타일 이미지들의 평균 색상을 미리 DB로 구축하고, 목표 이미지를 타일 크기로 잘라서 각 조각의 평균색과 가장 가까운 타일을 유클리드 거리로 찾아 배치하는 기초 알고리즘.
- **DavideA/photomosaic** ([https://github.com/DavideA/photomosaic](https://github.com/DavideA/photomosaic)): 소스 폴더의 이미지들을 리사이즈해서 평균색을 인덱싱하고 픽셀을 가까운 타일로 교체하는 OpenCV 기반 방식.
- **worldveil/photomosaic** ([https://github.com/worldveil/photomosaic](https://github.com/worldveil/photomosaic)): 타일 크기 조절 및 `opacity` 옵션으로 원본 사진과 타일 이미지를 섞는 비율 조절. (본 프로젝트의 원색 보존 vs 블렌딩 강도 조절에 큰 영감을 줌)
- **HellicarAndLewis/Mosaic** ([https://github.com/HellicarAndLewis/Mosaic](https://github.com/HellicarAndLewis/Mosaic)): 실시간 비디오 피드와 소셜 이미지를 결합한 인터랙티브 모자이크 시스템. Node.js 실시간 처리 구조 참고.
- **zmcx16/PhotoMosaic-Artifact** ([https://github.com/zmcx16/PhotoMosaic-Artifact](https://github.com/zmcx16/PhotoMosaic-Artifact)): `enhance colors` 파라미터로 원본 이미지 색상을 0~100% 강도로 섞는 고급 블렌딩 기법 참고.
