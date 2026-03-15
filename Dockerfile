FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Build frontend
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Copy backend + agent source
COPY backend/ ./backend/
COPY agent/ ./agent/

# Create uploads directory
RUN mkdir -p uploads && chown -R node:node /app

USER node

ENV NODE_ENV=production
EXPOSE 5000

CMD ["sh", "-c", "node backend/seeder && node backend/server.js"]
