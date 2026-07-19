FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && corepack pnpm install --frozen-lockfile
COPY . .
RUN corepack pnpm build
EXPOSE 3000
CMD ['corepack', 'pnpm', 'start']
