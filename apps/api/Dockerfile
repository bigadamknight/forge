# Pinned: a floating oven/bun:1 stays at whatever the build host cached
# (1.4.2 on hetzner, Oct 2026). 1.4.4 fixes the Brotli CVE-2026-111497.
FROM oven/bun:1.4.4 AS base
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
