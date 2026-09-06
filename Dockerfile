FROM node:22-alpine AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json index.js ./
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node sql ./sql
COPY --chown=node:node src ./src

USER node
EXPOSE 3000

CMD ["node", "index.js"]
