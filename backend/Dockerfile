# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS build

WORKDIR /app/backend

COPY packages/game-engine /app/packages/game-engine
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS runtime

ENV NODE_ENV=production
WORKDIR /app/backend

COPY packages/game-engine /app/packages/game-engine
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force \
    && rm -rf \
      /usr/local/lib/node_modules/npm \
      /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm \
      /usr/local/bin/npx \
      /usr/local/bin/corepack \
      /usr/local/bin/yarn \
      /usr/local/bin/yarnpkg \
      /usr/local/bin/pnpm \
      /usr/local/bin/pnpx \
      /opt/yarn-v* \
      /opt/pnpm

COPY --from=build --chown=node:node /app/backend/dist ./dist

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "dist/server.js"]
