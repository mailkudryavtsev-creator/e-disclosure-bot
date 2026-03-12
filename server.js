const { chromium } = require('playwright');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/search', async (req, res) => {
  console.log('Получен запрос на поиск');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    await page.goto('https://e-disclosure.ru/poisk-po-soobshheniyam', { waitUntil: 'networkidle' });
    console.log('Страница поиска загружена');

    // Диагностика
   // await page.screenshot({ path: 'after_goto.png' });
   // console.log('Скриншот after_goto.png сделан');

    const hasElement = await page.$('#textfieldEvent') !== null;
    console.log(`Элемент #textfieldEvent присутствует: ${hasElement}`);

    if (!hasElement) {
      const allIds = await page.$$eval('[id]', els => els.map(el => el.id));
      console.log('Найденные id на странице:', allIds);

      const frames = page.frames();
      console.log(`Количество фреймов: ${frames.length}`);
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        console.log(`Фрейм ${i}: ${frame.url()}`);
        const elInFrame = await frame.$('#textfieldEvent');
        if (elInFrame) {
          console.log(`Найден #textfieldEvent во фрейме ${i}`);
        }
      }
    }

    const keywordInput = await page.waitForSelector('#textfieldEvent', { timeout: 10000 });
    await keywordInput.fill('дивиденд, созыв, собрания');
    console.log('Введены ключевые слова');

    // ... (весь остальной код без изменений, до конца)

    // --- Работа с датой ---
    await page.click('#selected_period');
    console.log('Клик по кнопке выбора периода');

    await page.waitForSelector('#period', { timeout: 5000 });
    console.log('Окно выбора периода появилось');

    // Получаем сегодняшнюю дату
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const formattedDate = `${day}.${month}.${year}`;
    console.log(`Устанавливаем дату: ${formattedDate}`);
    

    // Ожидаем активности полей
    await page.waitForSelector('#dateStart:not([disabled])', { timeout: 5000 });
    await page.waitForSelector('#dateFinish:not([disabled])', { timeout: 5000 });

    // Заполняем dateStart с очисткой и посимвольным вводом
await page.click('#dateStart', { clickCount: 3 });
await page.keyboard.press('Backspace');
await page.type('#dateStart', formattedDate, { delay: 50 }); // эмуляция реального ввода
await page.$eval('#dateStart', el => el.dispatchEvent(new Event('input', { bubbles: true })));
await page.$eval('#dateStart', el => el.dispatchEvent(new Event('change', { bubbles: true })));
await page.keyboard.press('Tab'); // потеря фокуса
console.log('Поле dateStart заполнено (с type и tab)');

// Небольшая пауза
await page.waitForTimeout(100);

// Заполняем dateFinish аналогично
await page.click('#dateFinish', { clickCount: 3 });
await page.keyboard.press('Backspace');
await page.type('#dateFinish', formattedDate, { delay: 50 });
await page.$eval('#dateFinish', el => el.dispatchEvent(new Event('input', { bubbles: true })));
await page.$eval('#dateFinish', el => el.dispatchEvent(new Event('change', { bubbles: true })));
await page.keyboard.press('Tab');
console.log('Поле dateFinish заполнено (с type и tab)');

// Проверка значений (отладка)
const startVal = await page.$eval('#dateStart', el => el.value);
const finishVal = await page.$eval('#dateFinish', el => el.value);
console.log(`Фактические значения: dateStart=${startVal}, dateFinish=${finishVal}`);

// Ждём, пока кнопка подтверждения станет активной
await page.waitForSelector('#period__button-search:not([disabled])', { timeout: 7000 });
console.log('Кнопка подтверждения активна');

// Нажимаем кнопку применения даты
await page.click('#period__button-search');
console.log('Дата применена');

    // Улучшенное ожидание закрытия окна
    try {
      await page.waitForSelector('#period', { state: 'hidden', timeout: 7000 });
    } catch (e) {
      console.log('Окно не скрылось, пробуем клик вне его');
      await page.mouse.click(100, 100); // кликаем в шапку
      await page.waitForTimeout(1000);
      await page.waitForSelector('#period', { state: 'hidden', timeout: 5000 });
    }
    console.log('Окно выбора периода закрылось');

    // Нажимаем основную кнопку поиска
    await page.click('#sendButton');
    console.log('Запрос на поиск отправлен');

    // --- Ожидание результатов ---
    await page.waitForSelector('#searchResults', { timeout: 20000 });
    console.log('Блок результатов появился');

    // Дополнительная задержка для загрузки данных
    await page.waitForTimeout(3000);

    // Делаем скриншот для диагностики (можно закомментировать позже)
    //await page.screenshot({ path: 'after_search.png', fullPage: true });
    //console.log('Скриншот после поиска сохранён как after_search.png');

    // Проверяем наличие таблицы с результатами
    const hasResults = await page.locator('#searchResults table tr').count() > 0;

    let newsItems = [];
    if (hasResults) {
      console.log('Есть результаты, извлекаем данные');
      // Используем locator и evaluate для извлечения данных
      newsItems = await page.$$eval('#searchResults table tbody tr', rows => {
        return rows.map(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length < 2) return null;

          const date = cells[0]?.innerText.trim() || '';
          const contentCell = cells[1];

          const companyLink = contentCell.querySelector('a[href*="/portal/company.aspx"]');
          const companyName = companyLink?.innerText.trim() || '';
          const companyHref = companyLink?.href || '';

          const eventLink = contentCell.querySelector('a[href*="/portal/event.aspx"]');
          const eventText = eventLink?.innerText.trim() || '';
          const eventHref = eventLink?.href || '';

          const sourceSpan = contentCell.querySelector('span.graytext');
          const source = sourceSpan?.innerText.trim() || '';

          return { date, companyName, companyHref, eventText, eventHref, source };
        }).filter(item => item !== null);
      });
    } else {
      console.log('Таблица результатов не найдена. Выводим текст содержимого:');
      const text = await page.$eval('#searchResults', el => el.innerText);
      console.log(text.substring(0, 500));
    }

    console.log(`Всего получено записей: ${newsItems.length}`);

    // Фильтр по сегодняшней дате
    const todayItems = newsItems.filter(item => {
      if (!item.date) return false;
      const itemDatePart = item.date.split(' ')[0];
      return itemDatePart === formattedDate;
    });

    console.log(`Из них за сегодня (${formattedDate}): ${todayItems.length}`);

    await browser.close();
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