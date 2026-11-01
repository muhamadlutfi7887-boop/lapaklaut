FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
COPY docker-entrypoint.sh ./
EXPOSE 4000
CMD ["sh", "docker-entrypoint.sh"]
