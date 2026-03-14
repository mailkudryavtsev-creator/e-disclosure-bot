FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем npm-пакеты и сразу после установки доустанавливаем браузеры
RUN npm install && \
    npx playwright install chromium

# Копируем остальной код
COPY . .

# Убеждаемся, что путь к браузерам не переопределён (можно закомментировать или удалить)
# ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

EXPOSE 8080
CMD ["node", "server.js"]
