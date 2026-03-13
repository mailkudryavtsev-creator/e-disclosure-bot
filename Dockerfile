# Используем официальный образ Playwright с предустановленными браузерами
FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

# Копируем файлы зависимостей и устанавливаем npm-пакеты
COPY package*.json ./
RUN npm install

# Копируем остальной код проекта
COPY . .

# Указываем порт, который слушает приложение
EXPOSE 8080

# Запускаем сервер
CMD ["node", "server.js"]
