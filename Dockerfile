FROM node:18-alpine AS builder
WORKDIR /workspace

COPY dev-laoz-config-loader/package.json dev-laoz-config-loader/
COPY dev-laoz-config-loader/index.js dev-laoz-config-loader/
COPY dev-laoz-config-loader/src/ dev-laoz-config-loader/src/

COPY dev-laoz-api-gateway/package*.json app/
WORKDIR /workspace/app
RUN npm install --omit=dev --install-links

FROM node:18-alpine
WORKDIR /app

COPY --from=builder /workspace/app/node_modules ./node_modules
COPY dev-laoz-api-gateway/src ./src
COPY dev-laoz-api-gateway/package.json .

RUN addgroup -S appgroup && adduser -S appuser -G appgroup && chown -R appuser:appgroup /app
USER appuser

EXPOSE 3002
ENV NODE_ENV=production
CMD ["node", "src/server.js"]