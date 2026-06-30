// config.js
// 여기만 수정하면 에셋 교체·격자 변경 가능. 코드 건드릴 필요 없음.

const CONFIG = {

  server: {
    port: 3000,
    thumbnail_size: 600,      // 업로드 사진 리사이즈 px (긴 변 기준)
    backup_keep_days: 7,      // 백업 보관 일수
  },

  canvas: {
    width:  1920,
    height: 1080,
  },

  assets: {
    bg:      'bg.jpg',           // 우주 배경
  },

  blend: {
    mode: 'overlay', // 오버레이 블렌딩 (어둡게 뭉개지는 현상 방지)
    alpha: 0.7,      // 블렌드 강도 (0.0: 원색보존 ~ 1.0: 배경색감 강하게)
  },

  // 7×4 격자 — 비율값 (실제px = x * canvas.width)
  // active: false 칸은 슬롯 등록 안 됨 (배경만 보임)
  // ※ target_mask.png 확정 후 extract_coords.js 로 자동 재생성 가능
  grid: [
    { id:  0, row: 0, col: 0, x: 0.0000, y: 0.0000, w: 0.1429, h: 0.2500, active: false, brightness: 3 },
    { id:  1, row: 0, col: 1, x: 0.1429, y: 0.0000, w: 0.1429, h: 0.2500, active: false, brightness: 28 },
    { id:  2, row: 0, col: 2, x: 0.2857, y: 0.0000, w: 0.1429, h: 0.2500, active: true , brightness: 83 },
    { id:  3, row: 0, col: 3, x: 0.4286, y: 0.0000, w: 0.1429, h: 0.2500, active: true , brightness: 59 },
    { id:  4, row: 0, col: 4, x: 0.5714, y: 0.0000, w: 0.1429, h: 0.2500, active: true , brightness: 99 },
    { id:  5, row: 0, col: 5, x: 0.7143, y: 0.0000, w: 0.1429, h: 0.2500, active: true , brightness: 167 },
    { id:  6, row: 0, col: 6, x: 0.8571, y: 0.0000, w: 0.1429, h: 0.2500, active: false, brightness: 37 },
    { id:  7, row: 1, col: 0, x: 0.0000, y: 0.2500, w: 0.1429, h: 0.2500, active: false, brightness: 35 },
    { id:  8, row: 1, col: 1, x: 0.1429, y: 0.2500, w: 0.1429, h: 0.2500, active: true , brightness: 77 },
    { id:  9, row: 1, col: 2, x: 0.2857, y: 0.2500, w: 0.1429, h: 0.2500, active: true , brightness: 140 },
    { id: 10, row: 1, col: 3, x: 0.4286, y: 0.2500, w: 0.1429, h: 0.2500, active: true , brightness: 200 },
    { id: 11, row: 1, col: 4, x: 0.5714, y: 0.2500, w: 0.1429, h: 0.2500, active: true , brightness: 96 },
    { id: 12, row: 1, col: 5, x: 0.7143, y: 0.2500, w: 0.1429, h: 0.2500, active: false, brightness: 41 },
    { id: 13, row: 1, col: 6, x: 0.8571, y: 0.2500, w: 0.1429, h: 0.2500, active: false, brightness: 9 },
    { id: 14, row: 2, col: 0, x: 0.0000, y: 0.5000, w: 0.1429, h: 0.2500, active: false, brightness: 0 },
    { id: 15, row: 2, col: 1, x: 0.1429, y: 0.5000, w: 0.1429, h: 0.2500, active: false, brightness: 9 },
    { id: 16, row: 2, col: 2, x: 0.2857, y: 0.5000, w: 0.1429, h: 0.2500, active: true , brightness: 97 },
    { id: 17, row: 2, col: 3, x: 0.4286, y: 0.5000, w: 0.1429, h: 0.2500, active: true , brightness: 144 },
    { id: 18, row: 2, col: 4, x: 0.5714, y: 0.5000, w: 0.1429, h: 0.2500, active: true , brightness: 99 },
    { id: 19, row: 2, col: 5, x: 0.7143, y: 0.5000, w: 0.1429, h: 0.2500, active: false, brightness: 3 },
    { id: 20, row: 2, col: 6, x: 0.8571, y: 0.5000, w: 0.1429, h: 0.2500, active: false, brightness: 0 },
    { id: 21, row: 3, col: 0, x: 0.0000, y: 0.7500, w: 0.1429, h: 0.2500, active: false, brightness: 0 },
    { id: 22, row: 3, col: 1, x: 0.1429, y: 0.7500, w: 0.1429, h: 0.2500, active: true , brightness: 75 },
    { id: 23, row: 3, col: 2, x: 0.2857, y: 0.7500, w: 0.1429, h: 0.2500, active: true , brightness: 54 },
    { id: 24, row: 3, col: 3, x: 0.4286, y: 0.7500, w: 0.1429, h: 0.2500, active: true , brightness: 52 },
    { id: 25, row: 3, col: 4, x: 0.5714, y: 0.7500, w: 0.1429, h: 0.2500, active: true , brightness: 55 },
    { id: 26, row: 3, col: 5, x: 0.7143, y: 0.7500, w: 0.1429, h: 0.2500, active: true , brightness: 77 },
    { id: 27, row: 3, col: 6, x: 0.8571, y: 0.7500, w: 0.1429, h: 0.2500, active: false, brightness: 0 },
  ],
};

module.exports = CONFIG;
