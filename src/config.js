const fs = require('fs');
const path = require('path');
const gridTemplates = require('./gridTemplates');

const CONFIG_PATH = path.join(__dirname, '../data/config.json');

// 설정값을 읽어오는 함수
function loadConfig() {
  let userConfig = {};
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf8');
    userConfig = JSON.parse(data);
  } catch (err) {
    console.error('config.json 읽기 실패, 기본값 사용');
    userConfig = {
      activeTemplate: '12-slot',
      backgroundUrl: 'bg.jpg',
      tuning: {
        partialResetKeepCount: 6,
        autoResetDelayMs: 5000,
        blendMode: 'overlay',
        blendAlpha: 0.7
      }
    };
  }

  // 병합된 최종 설정 객체 반환
  return {
    server: {
      port: 3000,
      thumbnail_size: 600,
      backup_keep_days: 7,
    },
    canvas: {
      width: 1920,
      height: 1080,
    },
    assets: {
      bg: userConfig.activeBg || userConfig.backgroundUrl || 'bg_default.jpg',
    },
    blend: {
      mode: userConfig.tuning.blendMode,
      alpha: userConfig.tuning.blendAlpha,
    },
    tuning: userConfig.tuning,
    activeTemplate: userConfig.activeTemplate,
    activeBg: userConfig.activeBg || userConfig.backgroundUrl || 'bg_default.jpg',
    grid: gridTemplates[userConfig.activeTemplate] || gridTemplates['12-slot']
  };
}

// 설정값을 저장하는 함수
function saveConfig(newConfig) {
  const current = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const updated = { ...current, ...newConfig };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}

module.exports = {
  loadConfig,
  saveConfig
};
