# Production image: Next.js app plus the Prisma CLI for migrations on start.
FROM node:24-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npx next build

FROM base AS run
ENV NODE_ENV=production PORT=3000
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force
COPY --from=build /app/.next ./.next
COPY next.config.ts ./
USER node
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -p ${PORT}"]
