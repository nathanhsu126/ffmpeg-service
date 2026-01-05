# FFmpeg 微服務 Dockerfile
FROM node:18-alpine

# 安裝 FFmpeg
RUN apk add --no-cache ffmpeg

# 建立工作目錄
WORKDIR /app

# 複製 package.json
COPY package.json ./

# 安裝依賴
RUN npm install --production

# 複製應用程式
COPY server.js ./

# 建立暫存目錄
RUN mkdir -p /tmp/uploads /tmp/segments

# 暴露端口
EXPOSE 3000

# 啟動服務
CMD ["node", "server.js"]
