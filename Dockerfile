FROM node:24-alpine AS base

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
COPY scripts ./scripts

RUN npm ci
RUN npx prisma generate

FROM base AS build

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma
COPY scripts ./scripts

RUN npm ci --omit=dev
RUN npx prisma generate
RUN chmod +x ./scripts/start-production.sh

COPY --from=build /app/dist ./dist

EXPOSE 4000

CMD ["npm", "run", "start:production"]
