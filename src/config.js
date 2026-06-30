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

  // 4x3 격자 — 비율값 (실제px = x * canvas.width)
  // active: false 칸은 슬롯 등록 안 됨 (배경만 보임)
  grid: [
    { id:  0, row: 0, col: 0, x: 0.00, y: 0.0000, w: 0.25, h: 0.3333, active: true },
    { id:  1, row: 0, col: 1, x: 0.25, y: 0.0000, w: 0.25, h: 0.3333, active: true },
    { id:  2, row: 0, col: 2, x: 0.50, y: 0.0000, w: 0.25, h: 0.3333, active: true },
    { id:  3, row: 0, col: 3, x: 0.75, y: 0.0000, w: 0.25, h: 0.3333, active: true },
    { id:  4, row: 1, col: 0, x: 0.00, y: 0.3333, w: 0.25, h: 0.3333, active: true },
    { id:  5, row: 1, col: 1, x: 0.25, y: 0.3333, w: 0.25, h: 0.3333, active: true },
    { id:  6, row: 1, col: 2, x: 0.50, y: 0.3333, w: 0.25, h: 0.3333, active: true },
    { id:  7, row: 1, col: 3, x: 0.75, y: 0.3333, w: 0.25, h: 0.3333, active: true },
    { id:  8, row: 2, col: 0, x: 0.00, y: 0.6666, w: 0.25, h: 0.3333, active: true },
    { id:  9, row: 2, col: 1, x: 0.25, y: 0.6666, w: 0.25, h: 0.3333, active: true },
    { id: 10, row: 2, col: 2, x: 0.50, y: 0.6666, w: 0.25, h: 0.3333, active: true },
    { id: 11, row: 2, col: 3, x: 0.75, y: 0.6666, w: 0.25, h: 0.3333, active: true },
  ],
};

module.exports = CONFIG;
