FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY src ./src
EXPOSE 5000
CMD ["node", "src/index.js"]
