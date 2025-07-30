FROM node:18-alpine

WORKDIR /app

# パッケージファイルをコピーして依存関係をインストール
COPY package*.json ./
RUN npm ci --only=production

# アプリケーションファイルをコピー
COPY . .

# 本番用ビルド
RUN npm run build

# 本番サーバー用の軽量なWebサーバーをインストール
RUN npm install -g serve

EXPOSE 3000

# 本番環境では静的ファイルを配信
CMD ["serve", "-s", "build", "-l", "3000"]
