# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json

RUN npm ci

FROM deps AS build
WORKDIR /app

COPY . .

ENV NEXT_PUBLIC_API_BASE_URL=/api
ENV API_BASE_URL=/api
ENV INTERNAL_API_BASE_URL=http://127.0.0.1:3001/api

RUN npm run prisma:generate --workspace @yapd/api
RUN npm run build --workspace @yapd/api
RUN npm run build --workspace @yapd/web

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends bash openssl ca-certificates wget && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/package-lock.json ./package-lock.json
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/apps/web ./apps/web
COPY --from=build /app/scripts ./scripts

RUN chmod +x ./scripts/start-app-container.sh

EXPOSE 3000 3001

CMD ["bash", "./scripts/start-app-container.sh"]
