const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const upload = multer({ dest: '/tmp/uploads/' });

// 允許大檔案上傳
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// 健康檢查
app.get('/health', (req, res) => {
  exec('ffmpeg -version', (error, stdout) => {
    if (error) {
      return res.status(500).json({ 
        status: 'unhealthy', 
        error: 'FFmpeg not available' 
      });
    }
    res.json({ 
      status: 'healthy',
      ffmpeg: stdout.split('\n')[0]
    });
  });
});

// 切割音訊 API
app.post('/split-audio', upload.single('file'), async (req, res) => {
  const uploadedFile = req.file;
  const segmentTime = parseInt(req.body.segmentTime) || 900; // 預設 15 分鐘
  
  if (!uploadedFile) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const sessionId = crypto.randomUUID();
  const outputDir = `/tmp/segments_${sessionId}`;
  const outputPattern = path.join(outputDir, 'segment_%03d.m4a');

  try {
    // 建立輸出目錄
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 執行 FFmpeg 切割
    await new Promise((resolve, reject) => {
      const cmd = `ffmpeg -i "${uploadedFile.path}" -f segment -segment_time ${segmentTime} -c copy -reset_timestamps 1 "${outputPattern}"`;
      
      exec(cmd, { timeout: 120000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('FFmpeg Error:', stderr);
          reject(error);
        } else {
          resolve();
        }
      });
    });

    // 讀取所有切割後的檔案
    const segmentFiles = fs.readdirSync(outputDir)
      .filter(f => f.startsWith('segment_'))
      .sort();

    // 將檔案轉為 Base64
    const segments = segmentFiles.map((fileName, idx) => {
      const filePath = path.join(outputDir, fileName);
      const fileBuffer = fs.readFileSync(filePath);
      
      return {
        index: idx,
        fileName: fileName,
        data: fileBuffer.toString('base64'),
        size: fileBuffer.length
      };
    });

    // 清理暫存檔案
    fs.unlinkSync(uploadedFile.path);
    fs.rmSync(outputDir, { recursive: true, force: true });

    res.json({
      success: true,
      sessionId: sessionId,
      totalSegments: segments.length,
      segments: segments
    });

  } catch (error) {
    console.error('Split Error:', error);
    
    // 清理
    if (fs.existsSync(uploadedFile.path)) {
      fs.unlinkSync(uploadedFile.path);
    }
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Base64 輸入版本（不需要 multipart/form-data）
app.post('/split-audio-base64', express.json({ limit: '100mb' }), async (req, res) => {
  const { fileData, fileName, segmentTime } = req.body;
  
  if (!fileData) {
    return res.status(400).json({ error: 'No fileData provided' });
  }

  const sessionId = crypto.randomUUID();
  const inputPath = `/tmp/input_${sessionId}.m4a`;
  const outputDir = `/tmp/segments_${sessionId}`;
  const outputPattern = path.join(outputDir, 'segment_%03d.m4a');

  try {
    // 解碼 Base64 並寫入檔案
    const fileBuffer = Buffer.from(fileData, 'base64');
    fs.writeFileSync(inputPath, fileBuffer);

    // 建立輸出目錄
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 執行 FFmpeg
    const segTime = parseInt(segmentTime) || 900;
    await new Promise((resolve, reject) => {
      const cmd = `ffmpeg -i "${inputPath}" -f segment -segment_time ${segTime} -c copy -reset_timestamps 1 "${outputPattern}"`;
      
      exec(cmd, { timeout: 120000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('FFmpeg Error:', stderr);
          reject(error);
        } else {
          resolve();
        }
      });
    });

    // 讀取切割結果
    const segmentFiles = fs.readdirSync(outputDir)
      .filter(f => f.startsWith('segment_'))
      .sort();

    const segments = segmentFiles.map((file, idx) => {
      const filePath = path.join(outputDir, file);
      const buffer = fs.readFileSync(filePath);
      
      return {
        index: idx,
        fileName: file,
        data: buffer.toString('base64'),
        size: buffer.length
      };
    });

    // 清理
    fs.unlinkSync(inputPath);
    fs.rmSync(outputDir, { recursive: true, force: true });

    res.json({
      success: true,
      sessionId: sessionId,
      originalFile: fileName,
      totalSegments: segments.length,
      segments: segments
    });

  } catch (error) {
    console.error('Split Error:', error);
    
    // 清理
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true, force: true });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎬 FFmpeg Service running on port ${PORT}`);
});
