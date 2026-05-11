# 1. ビルド・実行環境として最新の Node.js (v24相当) を使用
FROM node:24-slim

# 2. 作業ディレクトリの作成
WORKDIR /app

# 3. 依存関係の定義ファイルをコピー
COPY package*.json ./

# 4. 依存関係のインストール（本番用のみに絞らず、tsxが必要なので一旦全部）
RUN npm install

# 5. ソースコードをコピー
COPY . .

# 6. K8sからのヘルスチェック用ポートを開放
EXPOSE 3000

# 7. tsx を使って直接起動（開発・本番共通で動く設定）
CMD ["npm", "run", "dev"]