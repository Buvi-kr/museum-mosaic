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
const CONFIG     = require('./config');

// ─── 경로 상수 ────────────────────────────────────────────────
const PUBLIC_DIR  = path.join(__dirname, '../public');
const UPLOAD_DIR  = path.join(PUBLIC_DIR, 'uploads');
const BACKUP_DIR  = path.join(PUBLIC_DIR, 'uploads', 'backup');
const DB_PATH     = path.join(__dirname, '../database.json');

[UPLOAD_DIR, BACKUP_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

// ─── 콘솔 로깅 및 파일 백업 ──────────────────────────────────
const LOG_FILE_PATH = path.join(__dirname, '../history/server.log');
const originalLog = console.log;
const originalError = console.error;

function writeToLogFile(level, args) {
  const time = new Date().toISOString();
  const msg = args.map(arg => {
    if (arg instanceof Error) return arg.stack;
    return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg;
  }).join(' ');
  const logLine = `[${time}] [${level}] ${msg}\n`;
  try {
    fs.appendFileSync(LOG_FILE_PATH, logLine, 'utf8');
  } catch (e) {
    originalError.call(console, 'Failed to write to server.log:', e);
  }
}

console.log = function(...args) {
  originalLog.apply(console, args);
  writeToLogFile('INFO', args);
};

console.error = function(...args) {
  originalError.apply(console, args);
  writeToLogFile('ERROR', args);
};

process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception detected!', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('WARNING: Unhandled Rejection detected at promise:', promise, 'reason:', reason);
});

// ─── Express + Socket.io ──────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.use(express.static(PUBLIC_DIR));

// ─── database.json 관리 ──────────────────────────────────────
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadDB() {
  if (!fs.existsSync(DB_PATH)) return initDB();
  try { 
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    // DB 파일은 있지만 슬롯 배열이 비어있으면 새로 초기화
    if (!db.slots || db.slots.length === 0) return initDB();
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

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// 날짜 달라졌으면 백업 후 리셋
async function checkAndReset() {
  const db = loadDB();
  if (db.date === todayKey()) return db;

  console.log(`[RESET] 날짜 변경 감지: ${db.date} → ${todayKey()}`);

  // 어제 업로드 폴더 압축 백업
  await backupUploads(db.date);

  // 업로드 폴더 정리 (backup 폴더 제외)
  const files = fs.readdirSync(UPLOAD_DIR);
  for (const f of files) {
    if (f === 'backup') continue;
    fs.rmSync(path.join(UPLOAD_DIR, f), { recursive: true, force: true });
  }

  // 오래된 백업 삭제
  cleanOldBackups();

  return initDB();
}

function backupUploads(dateStr) {
  return new Promise((resolve) => {
    const zipPath = path.join(BACKUP_DIR, `${dateStr}.zip`);
    const output  = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    output.on('close', resolve);
    archive.on('error', resolve); // 에러나도 계속 진행

    archive.pipe(output);
    // backup 폴더 제외하고 uploads 안 파일만 압축
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
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    cb(null, /image\/(jpeg|png|webp|heic)/.test(file.mimetype));
  },
});

// ─── 업로드 엔드포인트 ────────────────────────────────────────
app.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    const db = loadDB();

    // 슬롯 찾기: 빈 슬롯 우선, 없으면 가장 오래된 슬롯
    let slot;
    const emptySlots = db.slots.filter(s => !s.filled);
    
    if (emptySlots.length > 0) {
      // 랜덤 빈 슬롯 배정
      slot = emptySlots[Math.floor(Math.random() * emptySlots.length)];
    } else {
      // 가장 오래된 슬롯(timestamp 기준)을 찾아 교체
      const filledSlots = db.slots.filter(s => s.filled).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      slot = filledSlots[0];
      
      // 기존 사진 썸네일 파일 로컬 저장소에서 삭제
      if (slot.imagePath) {
        const oldThumbFilename = slot.imagePath.split('/').pop();
        const oldThumbPath = path.join(UPLOAD_DIR, oldThumbFilename);
        if (fs.existsSync(oldThumbPath)) {
          fs.rmSync(oldThumbPath, { force: true });
        }
      }
    }

    if (!req.file) {
      return res.status(400).json({ ok: false, message: '업로드된 파일이 없습니다.' });
    }

    // 원본 경로 및 최종 저장 썸네일 경로
    const originalPath  = req.file.path;
    const thumbFilename = `thumb_${req.file.filename}`;
    const thumbPath     = path.join(UPLOAD_DIR, thumbFilename);

    try {
      // 해당 슬롯의 조각 이미지 경로
      const slicePath = path.join(PUBLIC_DIR, 'slices', `slice_${slot.id}.jpg`);
      
      // 조각 이미지 메타데이터 읽기 (정확한 사이즈 픽셀)
      const sliceMeta = await sharp(slicePath).metadata();

      // 1. 사용자 사진을 조각 크기에 꽉 차게(cover) 리사이징 후 버퍼로 변환
      const userPhotoBuffer = await sharp(originalPath)
        .resize(sliceMeta.width, sliceMeta.height, { fit: 'cover' })
        .toBuffer();

      // 2. 우주선 배경 조각을 밑바탕(Base)으로 깔고, 사용자 사진을 그 위에 얹어 합성
      // soft-light를 적용하면 우주선의 형태가 강하게 유지되면서 사용자 사진이 은은하게 녹아듭니다.
      const blendMode = CONFIG.blend.mode === 'overlay' ? 'soft-light' : (CONFIG.blend.mode || 'soft-light');
      
      await sharp(slicePath)
        .composite([{ input: userPhotoBuffer, blend: blendMode }])
        .jpeg({ quality: 90 })
        .toFile(thumbPath);

      // 원본 삭제 (합성된 최종 썸네일만 보관)
      try { fs.rmSync(originalPath, { force: true }); } catch (e) {}
    } catch (imgError) {
      console.error('[IMAGE ERROR] 업로드된 이미지 처리 실패:', imgError);
      // 깨진 파일이거나 지원하지 않는 파일(HEIC 등)일 경우 에러 응답
      try { fs.rmSync(originalPath, { force: true }); } catch (e) {}
      return res.status(400).json({ ok: false, message: '지원하지 않는 이미지 형식이거나 파일이 손상되었습니다. (JPG/PNG 등을 사용해주세요)' });
    }

    // DB 업데이트
    const webPath = `/uploads/${thumbFilename}`;
    slot.filled    = true;
    slot.imagePath = webPath;
    slot.timestamp = new Date().toISOString();
    saveDB(db);

    // Socket.io 브로드캐스트 → display.html
    const gridInfo = CONFIG.grid.find(g => g.id === slot.id);
    io.emit('new_photo', {
      slotId:    slot.id,
      imagePath: webPath,
      row:       gridInfo.row,
      col:       gridInfo.col,
      x: gridInfo.x, y: gridInfo.y,
      w: gridInfo.w, h: gridInfo.h,
      totalFilled: db.slots.filter(s => s.filled).length,
      totalSlots:  db.slots.length,
    });

    res.json({
      ok:          true,
      slotId:      slot.id,
      row:         gridInfo.row + 1,
      col:         gridInfo.col + 1,
      imagePath:   webPath,
      totalFilled: db.slots.filter(s => s.filled).length,
      totalSlots:  db.slots.length,
    });

    // --- [NEW] 무한 사이클: 12칸 완성 시 자동 캡처 및 리셋 로직 ---
    if (db.slots.filter(s => s.filled).length === db.slots.length) {
      console.log('🌟 [SYSTEM] 모자이크 완성! 자동 병합 및 보관 시작...');
      io.emit('mosaic_complete'); // 프론트엔드에 완성 이벤트 브로드캐스트

      const completionsDir = path.join(__dirname, '../history/completions');
      if (!fs.existsSync(completionsDir)) {
        fs.mkdirSync(completionsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const finalImagePath = path.join(completionsDir, `mosaic_${timestamp}.jpg`);

      // 병합할 이미지 배열 준비
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

      // 백그라운드에서 비동기로 1920x1080 캔버스에 병합
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

      // 5초 뒤 화면 및 DB 초기화
      setTimeout(() => {
        console.log('[SYSTEM] 화면 및 데이터베이스 초기화(리셋)...');
        initDB(); // DB 파일 삭제 후 새로 생성
        // 기존 업로드된 썸네일들 삭제
        const files = fs.readdirSync(UPLOAD_DIR);
        for (const file of files) {
          if (file.startsWith('thumb_')) {
            try { fs.rmSync(path.join(UPLOAD_DIR, file), { force: true }); } catch (e) {}
          }
        }
        io.emit('reset'); // 프론트엔드 화면 비우기 지시
      }, 5000);
    }

  } catch (err) {
    console.error('[UPLOAD ERROR]', err);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, message: '서버 오류' });
    }
  }
});

// ─── 루트 리다이렉트 및 현재 슬롯 상태 조회 ──────────────────
app.get('/', (req, res) => {
  res.redirect('/guide.html');
});

app.get('/api/slots', (req, res) => {
  const db = loadDB();
  const result = db.slots.map(s => {
    const g = CONFIG.grid.find(g => g.id === s.id);
    return { ...s, ...g };
  });
  res.json({
    slots:       result,
    totalFilled: db.slots.filter(s => s.filled).length,
    totalSlots:  db.slots.length,
    date:        db.date,
    blend:       CONFIG.blend,
  });
});

// ─── Cloudflare 터널 URL 파싱 ────────────────────────────────
let tunnelUrl = null;

function startTunnel() {
  console.log('[TUNNEL] Starting Cloudflare Tunnel...');
  const localBin = path.join(__dirname, '../bin/cloudflared.exe');
  const bin = fs.existsSync(localBin) ? localBin : 'cloudflared';
  const cf = spawn(bin, [
    'tunnel', '--url', `http://localhost:${CONFIG.server.port}`
  ]);

  const parseUrl = (data) => {
    const str = data.toString();
    // Print cloudflared logs in the same window
    process.stdout.write(str);

    const match = str.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match && !tunnelUrl) {
      tunnelUrl = match[0];
      console.log('\n==================================================');
      console.log('             [SYSTEM] PHOTO MOSAIC SYSTEM URLS     ');
      console.log('==================================================');
      console.log(`  [Server]  Local Address:  http://localhost:${CONFIG.server.port}`);
      console.log(`  [Guide]   Local Address:  http://localhost:${CONFIG.server.port}/guide.html`);
      console.log(`  [Display] Local Address:  http://localhost:${CONFIG.server.port}/display.html`);
      console.log('--------------------------------------------------');
      console.log(`  [Guide]   Public Address: ${tunnelUrl}/guide.html`);
      console.log(`  [Display] Public Address: ${tunnelUrl}/display.html`);
      console.log(`  [Upload]  Public Address: ${tunnelUrl}/upload.html`);
      console.log('==================================================\n');
      io.emit('tunnel_url', { url: tunnelUrl });
    }
  };

  cf.stdout.on('data', parseUrl);
  cf.stderr.on('data', parseUrl);
  cf.on('close', (code) => {
    console.log(`[TUNNEL] Closed (code: ${code}), restarting in 10s...`);
    tunnelUrl = null;
    setTimeout(startTunnel, 10000);
  });
}

// ─── Socket.io 연결 ──────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[WS] 클라이언트 연결: ${socket.id}`);

  // 연결 즉시 현재 터널 URL 전송 (이미 있으면)
  if (tunnelUrl) socket.emit('tunnel_url', { url: tunnelUrl });

  socket.on('disconnect', () => {
    console.log(`[WS] 클라이언트 해제: ${socket.id}`);
  });
});

// ─── 서버 시작 ───────────────────────────────────────────────
async function main() {
  // 날짜 리셋 체크
  await checkAndReset();

  server.listen(CONFIG.server.port, () => {
    console.log(`[SERVER] http://localhost:${CONFIG.server.port}`);
    console.log(`[SERVER] display: http://localhost:${CONFIG.server.port}/display.html`);
    console.log(`[SERVER] guide:   http://localhost:${CONFIG.server.port}/guide.html`);

    // 터널 시작
    startTunnel();
  });
}

main().catch(console.error);
