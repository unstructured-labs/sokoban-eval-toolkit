FROM oven/bun:1.1.36-alpine

WORKDIR /repo
COPY package.json bun.lockb* tsconfig.base.json tsconfig.json ./
COPY apps/server ./apps/server
COPY packages ./packages
RUN bun install

WORKDIR /repo/apps/server
RUN bun run build

EXPOSE 3000
CMD ["bun", "run", "start"]
