// server.js
'use strict';

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const multer     = require('multer');
const sharp      = require('sharp');
const fs         = require('fs');
const path       = require('path');
const { spawn, exec }  = require('child_process');
const archiver   = require('archiver');
const configLoader = require('./config');
const gridTemplates = require('./gridTemplates');

let CONFIG = configLoader.loadConfig();

// ─── 경로 상수 ────────────────────────────────────────────────
const PUBLIC_DIR  = path.join(__dirname, '../public');
const UPLOAD_DIR  = path.join(PUBLIC_DIR, 'uploads');
const BACKUP_DIR  = path.join(PUBLIC_DIR, 'uploads', 'backup');
const DB_PATH     = path.join(__dirname, '../database.json');
const SLICES_DIR  = path.join(PUBLIC_DIR, 'slices');
const BG_DIR      = path.join(PUBLIC_DIR, 'backgrounds');
const HISTORY_DIR = path.join(__dirname, '../history');
const HISTORY_BG_DIR = path.join(HISTORY_DIR, 'backgrounds');
const HISTORY_SLICES_DIR = path.join(HISTORY_DIR, 'slices');

[UPLOAD_DIR, BACKUP_DIR, SLICES_DIR, BG_DIR, HISTORY_DIR, HISTORY_BG_DIR, HISTORY_SLICES_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

// ─── 콘솔 로깅 및 파일 백업 ──────────────────────────────────
const LOG_FILE_PATH = path.join(__dirname, '../history/server.log');

// --- 서버 기동 시 자동화 및 마이그레이션 루틴 ---
(async function startupRoutine() {
  // 1. AI가 생성한 신규 우주 배경 자동 임포트 (사용자 요청 사항)
  const generatedBgPath = 'C:\\Users\\Buvi\\.gemini\\antigravity-ide\\brain\\da353098-5346-4e35-81a5-f42dc5bac9af\\minecraft_earth_1782968751863.png';
  const targetBgPath = path.join(BG_DIR, 'bg_minecraft_earth.jpg');
  if (fs.existsSync(generatedBgPath) && !fs.existsSync(targetBgPath)) {
    console.log('[SYSTEM] AI가 임의로 생성한 신규 우주 배경(bg_cosmos_ai.jpg)을 복사합니다...');
    fs.copyFileSync(generatedBgPath, targetBgPath);
  }

  // 2. 기존 bg.jpg 호환성 처리
  const oldBg = path.join(PUBLIC_DIR, 'bg.jpg');
  const newBg = path.join(BG_DIR, 'bg_default.jpg');
  if (fs.existsSync(oldBg) && !fs.existsSync(newBg)) {
    fs.copyFileSync(oldBg, newBg);
  }

  // 3. 자를 수 있는 모든 배경(안 잘린 것들) 자동 슬라이싱 처리
  if (fs.existsSync(BG_DIR)) {
    const backgrounds = fs.readdirSync(BG_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
    for (const bg of backgrounds) {
      const sliceDir = path.join(SLICES_DIR, bg.replace(/\.(jpg|png)$/, ''));
      if (!fs.existsSync(sliceDir)) {
        console.log(`[SYSTEM] 조각이 없는 배경 감지. 자동 렌더링 진행: ${bg}`);
        await autoSliceBg(path.join(BG_DIR, bg), bg).catch(err => console.error(err));
      }
    }
  }
})();

const originalLog = console.log;
const originalError = console.error;

function writeToLogFile(level, args) {
  const time = new Date().toISOString();
  const msg = args.map(arg => {
    if (arg instanceof Error) return arg.stack;
    return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg;
  }).join(' ');
  const logLine = `[${time}] [${level}] ${msg}\n`;
  try { fs.appendFileSync(LOG_FILE_PATH, logLine, 'utf8'); } catch (e) {}
}

console.log = function(...args) {
  originalLog.apply(console, args);
  writeToLogFile('INFO', args);
};

console.error = function(...args) {
  originalError.apply(console, args);
  writeToLogFile('ERROR', args);
};

// ─── Express + Socket.io ──────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.use(express.static(PUBLIC_DIR));
app.use(express.json()); // Admin API를 위한 JSON 파싱

// ─── database.json 관리 ──────────────────────────────────────
function todayKey() { return new Date().toISOString().slice(0, 10); }

function loadDB() {
  if (!fs.existsSync(DB_PATH)) return initDB();
  try { 
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    // DB와 CONFIG의 슬롯 갯수가 다르면 템플릿이 변경된 것이므로 초기화
    if (!db.slots || db.slots.length !== CONFIG.grid.length) return initDB();
    return db;
  }
  catch { return initDB(); }
}

function initDB() {
  const activeSlots = CONFIG.grid
    .filter(t => t.active)
    .map(t => ({ id: t.id, filled: false, imagePath: null, timestamp: null }));

  const db = { date: todayKey(), slots: activeSlots };
  saveDB(db);
  return db;
}

function saveDB(db) { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }

async function checkAndReset() {
  const db = loadDB();
  if (db.date === todayKey()) return db;

  console.log(`[RESET] 날짜 변경 감지: ${db.date} → ${todayKey()}`);
  await backupUploads(db.date);

  const files = fs.readdirSync(UPLOAD_DIR);
  for (const f of files) {
    if (f === 'backup') continue;
    fs.rmSync(path.join(UPLOAD_DIR, f), { recursive: true, force: true });
  }
  cleanOldBackups();
  return initDB();
}

function backupUploads(dateStr) {
  return new Promise((resolve) => {
    const zipPath = path.join(BACKUP_DIR, `${dateStr}.zip`);
    const output  = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    output.on('close', resolve);
    archive.on('error', resolve);

    archive.pipe(output);
    const files = fs.readdirSync(UPLOAD_DIR).filter(f => f !== 'backup');
    files.forEach(f => {
      const fp = path.join(UPLOAD_DIR, f);
      if (fs.statSync(fp).isFile()) archive.file(fp, { name: f });
    });
    archive.finalize();
  });
}

function cleanOldBackups() {
  const keepMs = CONFIG.server.backup_keep_days * 86400 * 1000;
  const now    = Date.now();
  const files  = fs.readdirSync(BACKUP_DIR);
  for (const f of files) {
    const fp  = path.join(BACKUP_DIR, f);
    const age = now - fs.statSync(fp).mtimeMs;
    if (age > keepMs) fs.rmSync(fp, { force: true });
  }
}

// ─── multer 설정 ─────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, /image\/(jpeg|png|webp|heic)/.test(file.mimetype));
  },
});

// Admin 배경 업로드용
const adminBgStorage = multer.diskStorage({
  destination: PUBLIC_DIR,
  filename: (req, file, cb) => {
    cb(null, 'new_bg_temp' + path.extname(file.originalname).toLowerCase());
  }
});
const uploadAdminBg = multer({ storage: adminBgStorage });


// ─── ADMIN API ─────────────────────────────────────────────

app.get('/api/admin/config', (req, res) => {
  res.json({
    activeTemplate: CONFIG.activeTemplate,
    tuning: CONFIG.tuning,
    activeBg: CONFIG.activeBg || 'bg_default.jpg'
  });
});

app.get('/api/admin/backgrounds', (req, res) => {
  try {
    const publicBgs = fs.existsSync(BG_DIR) ? fs.readdirSync(BG_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.png')) : [];
    const historyBgs = fs.existsSync(HISTORY_BG_DIR) ? fs.readdirSync(HISTORY_BG_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.png')) : [];
    
    // 중복 제거 후 합치기
    const allBgs = Array.from(new Set([...publicBgs, ...historyBgs]));
    res.json({ ok: true, backgrounds: allBgs, activeBg: CONFIG.activeBg });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post('/api/admin/config', async (req, res) => {
  try {
    const newConfig = req.body;
    const oldTemplate = CONFIG.activeTemplate;
    const oldBg = CONFIG.activeBg;
    
    // 설정 저장
    configLoader.saveConfig(newConfig);
    CONFIG = configLoader.loadConfig(); // 메모리 갱신
    
    let message = '설정이 저장되었습니다.';

    // 템플릿이나 배경 변경 시 DB 초기화 (화면 리셋) 및 배경 스왑 처리
    if (oldTemplate !== CONFIG.activeTemplate || oldBg !== CONFIG.activeBg) {
      console.log(`[ADMIN] 화면 전환 감지: 템플릿(${oldTemplate} -> ${CONFIG.activeTemplate}), 배경(${oldBg} -> ${CONFIG.activeBg})`);
      
      // 배경이 바뀌었다면 history <-> public 간 파일 스왑 진행
      if (oldBg !== CONFIG.activeBg) {
        const oldBgBase = oldBg.replace(/\.(jpg|png)$/, '');
        const newBgBase = CONFIG.activeBg.replace(/\.(jpg|png)$/, '');
        
        // 1. 기존 사용 중이던 배경과 슬라이스를 history로 이동
        const oldBgFile = path.join(BG_DIR, oldBg);
        const oldSlicesDir = path.join(SLICES_DIR, oldBgBase);
        
        if (fs.existsSync(oldBgFile)) {
          fs.renameSync(oldBgFile, path.join(HISTORY_BG_DIR, oldBg));
        }
        if (fs.existsSync(oldSlicesDir)) {
          fs.renameSync(oldSlicesDir, path.join(HISTORY_SLICES_DIR, oldBgBase));
        }
        
        // 2. 새로 선택된 배경이 history에 있다면 public으로 복구
        const historyBgFile = path.join(HISTORY_BG_DIR, CONFIG.activeBg);
        const historySlicesDir = path.join(HISTORY_SLICES_DIR, newBgBase);
        
        if (fs.existsSync(historyBgFile)) {
          fs.renameSync(historyBgFile, path.join(BG_DIR, CONFIG.activeBg));
        }
        if (fs.existsSync(historySlicesDir)) {
          fs.renameSync(historySlicesDir, path.join(SLICES_DIR, newBgBase));
        }
      }

      initDB(); // 새 환경에 맞춰 DB 완전 초기화
      message += ' (화면 초기화 및 배경 히스토리 정리 완료)';
    }

    io.emit('config_updated'); // 프론트엔드 전체 새로고침 유도
    res.json({ ok: true, message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.post('/api/admin/upload-bg', uploadAdminBg.single('bg'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, message: '파일이 없습니다.' });
    
    const newBgPath = req.file.path;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const bgName = `bg_${timestamp}.jpg`;
    
    // 새 이미지를 backgrounds 폴더에 넣고 모든 템플릿에 대해 사전 렌더링
    await autoSliceBg(newBgPath, bgName);

    // 임시 업로드 파일 삭제
    try { fs.rmSync(newBgPath, { force: true }); } catch (e) {}

    res.json({ ok: true, message: '배경이 업로드되고 사전 렌더링이 완료되었습니다.', bgName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

// 배경을 1920x1080으로 맞추고 모든 슬롯 설정에 따라 미리 자르는(Pre-Slicing) 함수
async function autoSliceBg(inputImagePath, bgName) {
  console.log(`[SYSTEM] 자동 사전 렌더링(Pre-Slicing) 시작: ${bgName}...`);
  const finalBgPath = path.join(BG_DIR, bgName);
  
  // Windows 파일 잠금(Locking) 방지를 위해 sharp 캐시 비활성화
  sharp.cache(false);

  // 1. 원본 이미지를 1920x1080 규격으로 backgrounds 폴더에 복사
  const image = sharp(inputImagePath);
  await image
    .resize(CONFIG.canvas.width, CONFIG.canvas.height)
    .jpeg({ quality: 90 })
    .toFile(finalBgPath + '.tmp'); // 임시 저장
  
  try { if (fs.existsSync(finalBgPath)) fs.rmSync(finalBgPath, { force: true }); } catch(e) {}
  fs.renameSync(finalBgPath + '.tmp', finalBgPath); // 덮어쓰기

  // 2. 조각을 담을 배경별 최상위 폴더 생성
  const bgSliceDir = path.join(SLICES_DIR, bgName.replace('.jpg', ''));
  fs.mkdirSync(bgSliceDir, { recursive: true });

  // 3. gridTemplates에 있는 모든 템플릿(6, 12, 20, 28)에 대해 미리 조각내기
  for (const [templateName, grid] of Object.entries(gridTemplates)) {
    const templateDir = path.join(bgSliceDir, templateName);
    fs.mkdirSync(templateDir, { recursive: true });

    for (const slot of grid) {
      const baseLeft = Math.round(slot.x * CONFIG.canvas.width);
      const baseTop = Math.round(slot.y * CONFIG.canvas.height);
      const baseRight = Math.round((slot.x + slot.w) * CONFIG.canvas.width);
      const baseBottom = Math.round((slot.y + slot.h) * CONFIG.canvas.height);
      
      const left = baseLeft + 2;
      const top = baseTop + 2;
      const right = baseRight - 2;
      const bottom = baseBottom - 2;

      const width = right - left;
      const height = bottom - top;

      const slicePath = path.join(templateDir, `slice_${slot.id}.jpg`);
      await sharp(finalBgPath)
        .extract({ left, top, width, height })
        .jpeg({ quality: 90 })
        .toFile(slicePath);
    }
  }
  console.log(`[SYSTEM] 사전 렌더링 완료: ${bgName} (모든 템플릿 지원)`);
}

// ─── 일반 API ──────────────────────────────────────────────
app.get('/api/slots', async (req, res) => {
  const db = await checkAndReset();
  const filledSlots = db.slots.filter(s => s.filled);
  res.json({
    totalFilled: filledSlots.length,
    totalSlots: db.slots.length,
    slots: filledSlots.map(s => ({
      id: s.id,
      imagePath: s.imagePath
    }))
  });
});

app.get('/api/grid', (req, res) => {
  // 클라이언트에게 현재 좌표를 전달 (config.js 파일 분리용)
  res.json({
    activeTemplate: CONFIG.activeTemplate,
    activeBg: CONFIG.activeBg || 'bg_default.jpg',
    grid: CONFIG.grid
  });
});

// ─── 업로드 엔드포인트 ────────────────────────────────────────
app.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, message: '파일이 없습니다.' });

    const originalPath = req.file.path;
    const db = await checkAndReset();

    // 1. 빈 슬롯 찾기
    let slot;
    const emptySlots = db.slots.filter(s => !s.filled);
    
    if (emptySlots.length > 0) {
      slot = emptySlots[Math.floor(Math.random() * emptySlots.length)];
    } else {
      const filledSlots = db.slots.filter(s => s.filled).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      slot = filledSlots[0];
      if (slot.imagePath) {
        const oldThumbPath = path.join(UPLOAD_DIR, path.basename(slot.imagePath));
        if (fs.existsSync(oldThumbPath)) { fs.rmSync(oldThumbPath, { force: true }); }
      }
    }

    const slotId = slot.id;

    // 2. config.json에서 활성화된 템플릿과 배경 가져오기
    const activeBg = CONFIG.activeBg || 'bg_default.jpg';
    const bgDirName = activeBg.replace('.jpg', '');
    const activeTemplate = CONFIG.activeTemplate;

    // 새로운 사전 렌더링 다중 폴더 구조에서 슬라이스 가져오기
    const slicePath = path.join(SLICES_DIR, bgDirName, activeTemplate, `slice_${slotId}.jpg`);
    
    try {
      // 3. 슬라이스 이미지 해상도 파악
      const sliceMeta = await sharp(slicePath).metadata();

      const userPhotoBuffer = await sharp(originalPath)
        .resize(sliceMeta.width, sliceMeta.height, { fit: 'cover' })
        .toBuffer();

      const thumbFilename = `thumb_${req.file.filename}`;
      const thumbPath     = path.join(UPLOAD_DIR, thumbFilename);

      const blendMode = CONFIG.blend && CONFIG.blend.mode === 'overlay' ? 'soft-light' : (CONFIG.blend ? CONFIG.blend.mode : 'soft-light');
      
      await sharp(slicePath)
        .composite([{ input: userPhotoBuffer, blend: blendMode }])
        .jpeg({ quality: 90 })
        .toFile(thumbPath);

      try { fs.rmSync(originalPath, { force: true }); } catch (e) {}

      // 4. DB 업데이트
      slot.filled = true;
      slot.imagePath = `/uploads/${thumbFilename}`;
      slot.timestamp = new Date().toISOString();
      saveDB(db);

      io.emit('new_photo', {
        slotId: slot.id,
        imagePath: slot.imagePath,
        timestamp: slot.timestamp,
        isCompleted: db.slots.every(s => s.filled)
      });

      // --- [NEW] 무한 사이클: 12칸 완성 시 자동 캡처 및 부분 리셋 로직 ---
      if (db.slots.filter(s => s.filled).length === db.slots.length) {
        console.log('🌟 [SYSTEM] 모자이크 완성! 자동 병합 및 보관 시작...');
        io.emit('mosaic_complete');

        const completionsDir = path.join(__dirname, '../history/completions');
        if (!fs.existsSync(completionsDir)) { fs.mkdirSync(completionsDir, { recursive: true }); }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const finalImagePath = path.join(completionsDir, `mosaic_${timestamp}.jpg`);

        const compositeInputs = db.slots.map(s => {
          const g = CONFIG.grid.find(gridItem => gridItem.id === s.id);
          const left = Math.round(g.x * CONFIG.canvas.width);
          const top = Math.round(g.y * CONFIG.canvas.height);
          return {
            input: path.join(UPLOAD_DIR, path.basename(s.imagePath)),
            left: left,
            top: top
          };
        });

        sharp({
          create: {
            width: CONFIG.canvas.width,
            height: CONFIG.canvas.height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 1 }
          }
        })
        .composite(compositeInputs)
        .jpeg({ quality: 95 })
        .toFile(finalImagePath)
        .then(() => {
          console.log(`[+] 완성본 영구 보관 완료: ${finalImagePath}`);
        })
        .catch(err => {
          console.error('[ERROR] 완성본 병합 실패:', err);
        });

        // 동적으로 설정된 시간 뒤 부분 초기화
        const delayMs = CONFIG.tuning.autoResetDelayMs || 5000;
        setTimeout(() => {
          console.log('[SYSTEM] 화면 절반 유지 및 부분 초기화(리셋)...');
          
          const keepCount = CONFIG.tuning.partialResetKeepCount || 6;
          const filledSlots = db.slots.filter(s => s.filled);
          const slotsToKeep = filledSlots.sort(() => 0.5 - Math.random()).slice(0, keepCount);
          const keepIds = slotsToKeep.map(s => s.id);

          db.slots = db.slots.map(s => {
            if (!keepIds.includes(s.id)) {
              return { ...s, filled: false, imagePath: null, timestamp: null };
            }
            return s;
          });
          saveDB(db);

          const files = fs.readdirSync(UPLOAD_DIR);
          const keptThumbnames = slotsToKeep.map(s => path.basename(s.imagePath));
          for (const file of files) {
            if (file.startsWith('thumb_') && !keptThumbnames.includes(file)) {
              try { fs.rmSync(path.join(UPLOAD_DIR, file), { force: true }); } catch (e) {}
            }
          }
          
          io.emit('partial_reset', { keepIds });
        }, delayMs);
      }

      return res.json({ ok: true, message: '업로드 완료!', id: slot.id });
    } catch (imgError) {
      console.error('[IMAGE ERROR] 업로드된 이미지 처리 실패:', imgError);
      try { fs.rmSync(originalPath, { force: true }); } catch (e) {}
      return res.status(400).json({ ok: false, message: '지원하지 않는 이미지 형식이거나 파일이 손상되었습니다.' });
    }
  } catch (err) {
    console.error('[UPLOAD ERROR]', err);
    return res.status(500).json({ ok: false, message: '서버 오류가 발생했습니다.' });
  }
});


// ─── Cloudflare 터널 유지 코드 (이하 생략하지 않고 유지) ────────────────
let cloudflaredProcess = null;
let currentTunnelUrl = null;

function startCloudflared() {
  const cfPath = path.join(__dirname, '../bin/cloudflared-windows-amd64.exe');
  
  if (!fs.existsSync(cfPath)) {
    console.warn('[TUNNEL] cloudflared 실행 파일을 찾을 수 없습니다. (로컬 터널 없이 시작)');
    return;
  }

  console.log('[TUNNEL] Starting Cloudflare Tunnel...');
  cloudflaredProcess = spawn(cfPath, ['tunnel', '--url', `http://localhost:${CONFIG.server.port}`]);

  cloudflaredProcess.stdout.on('data', (data) => console.log(data.toString().trim()));
  cloudflaredProcess.stderr.on('data', (data) => {
    const output = data.toString();
    const urlMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (urlMatch) {
      currentTunnelUrl = urlMatch[0];
      
      console.log('\n==================================================');
      console.log('             [SYSTEM] PHOTO MOSAIC SYSTEM URLS     ');
      console.log('==================================================');
      console.log(`  [Server]  Local Address:  http://localhost:${CONFIG.server.port}`);
      console.log(`  [Guide]   Local Address:  http://localhost:${CONFIG.server.port}/guide.html`);
      console.log(`  [Display] Local Address:  http://localhost:${CONFIG.server.port}/display.html`);
      console.log('--------------------------------------------------');
      console.log(`  [Guide]   Public Address: ${currentTunnelUrl}/guide.html`);
      console.log(`  [Display] Public Address: ${currentTunnelUrl}/display.html`);
      console.log(`  [Upload]  Public Address: ${currentTunnelUrl}/upload.html`);
      console.log('==================================================\n');
      
      io.emit('tunnel_url', { url: currentTunnelUrl });
    }
  });

  cloudflaredProcess.on('close', (code) => {
    console.log(`[TUNNEL] cloudflared process exited with code ${code}`);
    currentTunnelUrl = null;
  });
}

io.on('connection', (socket) => {
  console.log(`[WS] 클라이언트 연결: ${socket.id}`);
  if (currentTunnelUrl) {
    socket.emit('tunnel_url', { url: currentTunnelUrl });
  }
  socket.on('disconnect', () => {
    console.log(`[WS] 클라이언트 해제: ${socket.id}`);
  });
});

server.listen(CONFIG.server.port, () => {
  console.log(`[SERVER] http://localhost:${CONFIG.server.port}`);
  console.log(`[SERVER] display: http://localhost:${CONFIG.server.port}/display.html`);
  console.log(`[SERVER] guide:   http://localhost:${CONFIG.server.port}/guide.html`);
  startCloudflared();
});

function gracefulShutdown() {
  console.log('\n[SYSTEM] Shutting down...');
  if (cloudflaredProcess) {
    cloudflaredProcess.kill('SIGINT');
  }
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
