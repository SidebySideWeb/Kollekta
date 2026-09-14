FROM node:22-alpine

RUN apk add --no-cache vips-dev python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Writable runtime dirs — owned by the non-root `node` user (uid 1000).
# sharp / better-sqlite3 are built above as root; only the process user changes.
RUN mkdir -p data uploads public/logo logo tmp \
  && chown -R node:node data uploads public/logo logo tmp

EXPOSE 3000

USER node

CMD ["node", "server.js"]
