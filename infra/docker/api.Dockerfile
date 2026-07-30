FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/application/package.json packages/application/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/infrastructure/package.json packages/infrastructure/package.json

RUN npm ci

COPY apps/api apps/api
COPY packages packages

RUN npm run build:packages && npm run build --workspace @security-log-analyzer/api && npm prune --omit=dev

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV UPLOAD_STORAGE_DIR=/data/uploads

WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api ./apps/api
COPY --from=build --chown=node:node /app/packages ./packages

RUN mkdir -p /data/uploads && chown -R node:node /data

USER node

EXPOSE 4000

CMD ["node", "apps/api/dist/server.js"]