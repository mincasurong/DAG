FROM node:22-alpine

WORKDIR /app

RUN npm install --no-audit --no-fund express@^5.2.1 cors@^2.8.6

COPY server.cjs ./server.cjs
COPY dist ./dist

ENV NODE_ENV=production
ENV PORT=8080
ENV TZ=Asia/Seoul
EXPOSE 8080

CMD ["node", "server.cjs"]
