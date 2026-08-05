FROM node:20-slim

WORKDIR /app

# openssl dibutuhkan Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# prisma harus ada duluan karena postinstall menjalankan prisma generate
COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npx", "tsx", "src/index.ts"]
