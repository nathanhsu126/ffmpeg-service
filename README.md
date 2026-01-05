# FFmpeg 音訊切割微服務

獨立的 FFmpeg 服務，用於切割大型音訊檔案。

## API 端點

### 1. 健康檢查
```
GET /health
```

回應：
```json
{
  "status": "healthy",
  "ffmpeg": "ffmpeg version 6.x.x"
}
```

### 2. 切割音訊（Multipart）
```
POST /split-audio
Content-Type: multipart/form-data

參數：
- file: 音訊檔案
- segmentTime: 每段秒數（預設 900 = 15分鐘）
```

回應：
```json
{
  "success": true,
  "sessionId": "uuid",
  "totalSegments": 3,
  "segments": [
    {
      "index": 0,
      "fileName": "segment_000.m4a",
      "data": "base64...",
      "size": 12345678
    }
  ]
}
```

### 3. 切割音訊（Base64）
```
POST /split-audio-base64
Content-Type: application/json

Body:
{
  "fileData": "base64編碼的音訊檔案",
  "fileName": "audio.m4a",
  "segmentTime": 900
}
```

## 部署到 Zeabur

1. 上傳所有檔案到 GitHub
2. 在 Zeabur 建立新服務
3. 選擇 Git 儲存庫
4. Zeabur 會自動偵測 Dockerfile 並建置
5. 記下服務網址（例如：https://ffmpeg.zeabur.app）

## 使用範例（n8n）

在 n8n 的「HTTP Request」節點：

```javascript
{
  "method": "POST",
  "url": "https://ffmpeg.zeabur.app/split-audio-base64",
  "body": {
    "fileData": "={{ $binary.file.data }}",
    "fileName": "={{ $json.fileName }}",
    "segmentTime": 900
  }
}
```
