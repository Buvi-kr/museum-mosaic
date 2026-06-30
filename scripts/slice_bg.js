const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const CONFIG = require('../src/config.js');

const inputImagePath = 'C:\\Users\\Buvi\\.gemini\\antigravity-ide\\brain\\752842fe-47c3-4f52-ba96-93497239538f\\ghibli_space_bg_1782792931666.png';
const publicDir = path.join(__dirname, '../public');
const outputBgPath = path.join(publicDir, 'bg.jpg');
const slicesDir = path.join(publicDir, 'slices');

if (!fs.existsSync(slicesDir)) {
  fs.mkdirSync(slicesDir, { recursive: true });
}

async function main() {
  try {
    // 1. 원본 이미지를 bg.jpg 로 복사/변환 (canvas size에 맞춤)
    const image = sharp(inputImagePath);

    await image
      .resize(CONFIG.canvas.width, CONFIG.canvas.height)
      .jpeg({ quality: 90 })
      .toFile(outputBgPath);
      
    console.log(`[+] Created ${outputBgPath} (1920x1080)`);

    // 2. 조각내기
    for (const slot of CONFIG.grid) {
      const left = Math.round(slot.x * CONFIG.canvas.width);
      const top = Math.round(slot.y * CONFIG.canvas.height);
      const width = Math.round(slot.w * CONFIG.canvas.width);
      const height = Math.round(slot.h * CONFIG.canvas.height);

      const slicePath = path.join(slicesDir, `slice_${slot.id}.jpg`);
      await sharp(outputBgPath)
        .extract({ left, top, width, height })
        .jpeg({ quality: 90 })
        .toFile(slicePath);
      
      console.log(`[+] Created slice_${slot.id}.jpg`);
    }

    console.log('[+] Slicing complete!');
  } catch (err) {
    console.error(err);
  }
}

main();
