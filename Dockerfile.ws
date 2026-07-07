# Dockerfile for the standalone WebSocket sync server (deploy to Railway/Render/Fly).
# The Next.js app deploys separately to Vercel.
FROM node:24-alpine

WORKDIR /app

# Install dependencies (cached unless package files change).
COPY package.json package-lock.json ./
RUN npm ci

# Prisma client is needed by the server for persistence.
COPY prisma ./prisma
RUN npx prisma generate

# App source (server + shared lib it imports).
COPY tsconfig.json ./
COPY src ./src
COPY server ./server

ENV NODE_ENV=production
# Railway/Render inject PORT; the server reads it (defaults to 1234).
EXPOSE 1234

CMD ["npx", "tsx", "server/ws-server.ts"]
