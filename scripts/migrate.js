const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const gridTemplates = require('../src/gridTemplates.js');

const PUBLIC_DIR = path.join(__dirname, '../public');
const BG_DIR = path.join(PUBLIC_DIR, 'backgrounds');
const SLICES_DIR = path.join(PUBLIC_DIR, 'slices');
const oldBg = path.join(PUBLIC_DIR, 'bg.jpg');
const newBg = path.join(BG_DIR, 'bg_default.jpg');

async function migrate() {
    if (!fs.existsSync(BG_DIR)) {
        fs.mkdirSync(BG_DIR, { recursive: true });
    }
    
    if (fs.existsSync(oldBg)) {
        fs.copyFileSync(oldBg, newBg);
        console.log('Old bg.jpg migrated to bg_default.jpg');
    } else {
        console.log('No old bg.jpg found, skipping migration.');
        return;
    }

    const bgSliceDir = path.join(SLICES_DIR, 'bg_default');
    if (fs.existsSync(bgSliceDir)) fs.rmSync(bgSliceDir, { recursive: true, force: true });
    fs.mkdirSync(bgSliceDir, { recursive: true });

    console.log('Pre-slicing bg_default.jpg for all templates...');
    
    for (const [templateName, grid] of Object.entries(gridTemplates)) {
        const templateDir = path.join(bgSliceDir, templateName);
        fs.mkdirSync(templateDir, { recursive: true });
        
        for (const slot of grid) {
            const baseLeft = Math.round(slot.x * 1920);
            const baseTop = Math.round(slot.y * 1080);
            const baseRight = Math.round((slot.x + slot.w) * 1920);
            const baseBottom = Math.round((slot.y + slot.h) * 1080);
            
            const left = baseLeft + 2;
            const top = baseTop + 2;
            const right = baseRight - 2;
            const bottom = baseBottom - 2;

            const width = right - left;
            const height = bottom - top;

            const slicePath = path.join(templateDir, 'slice_' + slot.id + '.jpg');
            await sharp(newBg)
                .extract({ left, top, width, height })
                .jpeg({ quality: 90 })
                .toFile(slicePath);
        }
    }
    console.log('Migration and pre-slicing complete!');
}

migrate().catch(console.error);
