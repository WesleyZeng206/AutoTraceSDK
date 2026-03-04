#builder stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY ingestion/package*.json ./
RUN npm ci
COPY ingestion ./
COPY shared ../shared
RUN npm run build

#runtime stage
FROM node:20-alpine
WORKDIR /app
COPY ingestion/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db/migrations ./src/db/migrations
EXPOSE 4000
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
