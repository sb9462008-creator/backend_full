FROM node:22-bookworm-slim AS base

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
COPY scripts ./scripts

RUN npm ci
RUN npx prisma generate

FROM base AS build

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
COPY scripts ./scripts

RUN npm ci --omit=dev
RUN npx prisma generate
RUN chmod +x ./scripts/start-production.sh

COPY --from=build /app/dist ./dist

EXPOSE 4000

CMD ["npm", "run", "start:production"]
