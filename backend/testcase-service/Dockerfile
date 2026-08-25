FROM node:22-bookworm

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       g++ \
       ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY src ./src

RUN mkdir -p /app/runtime

EXPOSE 4006

CMD ["node", "src/server.js"]