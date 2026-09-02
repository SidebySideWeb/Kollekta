FROM node:22-alpine

RUN apk add --no-cache vips-dev python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p data uploads public/logo tmp

EXPOSE 3000

CMD ["node", "server.js"]
