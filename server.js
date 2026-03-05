const express = require('express');
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/search', async (req, res) => {
  console.log('Получен запрос на поиск');
  
  // Запускаем браузер. headless: false временно для отладки (потом можно сменить на true)
  const browser = await chromium.launch({ headless: true }); 
  const page = await browser.newPage();

  try {
    // 1. Переходим на страницу поиска
    await page.goto('https://e-disclosure.ru/poisk-po-soobshheniyam', { waitUntil: 'networkidle' });
    console.log('Страница поиска загружена');

    // 2. Вводим ключевые слова (селектор нужно уточнить!)
    // Предположим, что поле ввода имеет id="query" или name="query". Уточните у пользователя.
    // Пока используем универсальный селектор для поля ввода (возможно, это input[type=text])
    const keywordInput = await page.$('#textfieldEvent'); // Замените на правильный селектор!
    if (keywordInput) {
      await keywordInput.fill('дивиденд, созыв, собрания');
      console.log('Введены ключевые слова');
    } else {
      throw new Error('Поле ввода ключевых слов не найдено');
    }

    // 3. Устанавливаем дату (сегодня)
    // 3.1 Клик на кнопку выбора периода
    await page.click('#selected_period');
    console.log('Клик по кнопке выбора периода');

    // 3.2 Ждём появления всплывающего окна
    await page.waitForSelector('#period', { timeout: 5000 });
    console.log('Окно выбора периода появилось');

    // 3.3 Получаем сегодняшнюю дату в формате ДД.ММ.ГГГГ
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const formattedDate = `${day}.${month}.${year}`;
    console.log(`Устанавливаем дату: ${formattedDate}`);

    // 3.4 Заполняем поля начальной и конечной даты
    //await page.fill('#dateStart', formattedDate);
    await page.fill('#dateFinish', formattedDate);
    console.log('Поля даты заполнены');

    // 3.5 Нажимаем кнопку применения даты внутри окна
    await page.click('#period__button-search');
    console.log('Дата применена');

    // 3.6 Ждём, пока окно закроется (элемент #period исчезнет)
    await page.waitForSelector('#period', { state: 'hidden', timeout: 5000 });

    // 4. Нажимаем основную кнопку поиска
    await page.click('#sendButton');
    console.log('Запрос на поиск отправлен');

    // 5. Ждём появления результатов
    // Результаты появляются внутри #searchResults. Ждём, когда там появятся строки таблицы.
    await page.waitForSelector('#searchResults table tr', { timeout: 10000 });
    console.log('Результаты загружены');

    // 6. Извлекаем данные из таблицы
    const newsItems = await page.$$eval('#searchResults table tr', rows => {
      return rows.map(row => {
        // Пропускаем заголовки таблицы, если они есть (например, <th>)
        if (row.querySelector('th')) return null;

        const cells = row.querySelectorAll('td');
        if (cells.length < 2) return null;

        const dateCell = cells[0];
        const contentCell = cells[1];

        const date = dateCell ? dateCell.innerText.trim() : '';

        // Ищем ссылку на компанию
        const companyLink = contentCell.querySelector('a[href*="/portal/company.aspx"]');
        const companyName = companyLink ? companyLink.innerText.trim() : '';
        const companyHref = companyLink ? companyLink.href : '';

        // Ищем ссылку на событие
        const eventLink = contentCell.querySelector('a[href*="/portal/event.aspx"]');
        const eventText = eventLink ? eventLink.innerText.trim() : '';
        const eventHref = eventLink ? eventLink.href : '';

        // Ищем источник (серый текст)
        const sourceSpan = contentCell.querySelector('span.graytext');
        const source = sourceSpan ? sourceSpan.innerText.trim() : '';

        return {
          date,
          companyName,
          companyHref,
          eventText,
          eventHref,
          source
        };
      }).filter(item => item !== null); // убираем пустые (заголовки)
    });

    console.log(`Всего получено записей: ${newsItems.length}`);

// Фильтруем записи, оставляем только те, у которых дата совпадает с сегодняшним днём
const todayStr = formattedDate; // formattedDate уже содержит строку вида "05.03.2026"
const todayItems = newsItems.filter(item => {
  if (!item.date) return false;
  // item.date имеет формат "05.03.2026 17:00" — берём часть до пробела
  const itemDatePart = item.date.split(' ')[0];
  return itemDatePart === todayStr;
});

console.log(`Из них за сегодня (${todayStr}): ${todayItems.length}`);

await browser.close();

// Отправляем только отфильтрованные записи (поле data)
// Для отладки можно также включить все записи, но в n8n потом используйте data
res.json({ success: true, data: todayItems, all: newsItems });
  } catch (error) {
    console.error('Ошибка:', error);
    await browser.close();
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});