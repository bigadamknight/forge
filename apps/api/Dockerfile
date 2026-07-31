FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json yarn.lock ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN bun install

# Copy source
COPY apps/api/ apps/api/
COPY packages/db/ packages/db/
COPY packages/shared/ packages/shared/
COPY tsconfig.base.json ./

EXPOSE 3071
CMD ["bun", "run", "apps/api/src/index.ts"]
