FROM node:18-slim

# Устанавливаем системные зависимости, необходимые для Chromium
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libatk1.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libxkbcommon0 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install
# Устанавливаем браузер (chromium) с зависимостями
RUN npx playwright install chromium --with-deps

COPY . .

EXPOSE 8080
CMD ["node", "server.js"]