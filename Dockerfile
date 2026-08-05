FROM node:20-slim

WORKDIR /app

# openssl dibutuhkan Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 3000

CMD ["npx", "tsx", "src/index.ts"]
