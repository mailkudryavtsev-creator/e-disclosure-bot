FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

COPY package*.json ./
RUN npm install && \
    # Явно устанавливаем браузеры в стандартную папку Playwright
    npx playwright install chromium

COPY . .

EXPOSE 8080
CMD ["node", "server.js"]
