# СИСТЕМА 21:00

Закрытый Telegram-канал дисциплины. Вход по заявке через бота.

## Состав

- `index.html` — одностраничный сайт.
- `styles.css` — dark/brutalist дизайн.
- `config.js` — ссылка на Telegram-бота и статистика.
- `bot/bot.js` — Telegram-бот отбора (polling, для VPS).
- `netlify/functions/bot.mjs` — Telegram-бот (webhook, для Netlify).
- `docs/strategy-max.md` — контент-план и операционная логика.

## Развёртывание

### 1. GitHub

```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/youngdoll/motivator.git
git push -u origin main
```

### 2. Сайт на Netlify

Сайт деплоится из корня репозитория. `netlify.toml` уже настроен.

### 3. Бот на Netlify Functions

Бот работает через Telegram Webhook + Netlify Function (бесплатно).

**Настройка переменных в Netlify Dashboard (Site > Environment variables):**

| Переменная | Описание |
|---|---|
| `BOT_TOKEN` | Токен бота от @BotFather |
| `ADMIN_CHAT_ID` | Твой Telegram chat id (узнать: `/id`) |
| `INVITE_LINK` | Ссылка-приглашение в закрытый канал |
| `REPORT_TIME` | Время отчёта (по умолч. 21:00) |
| `REAPPLY_DAYS` | Дней до повторной подачи (по умолч. 30) |

**После деплоя — настроить вебхук Telegram:**

```bash
curl -X POST "https://api.telegram.org/bot<ТОКЕН>/setWebhook?url=https://<САЙТ>.netlify.app/.netlify/functions/bot"
```

### 4. Локальный запуск бота

```bash
cp bot/.env.example bot/.env
# заполнить .env
node bot/bot.js
```

## Сайт

Открой `config.js` — замени ссылку на бота и цифры статистики.

```js
telegramBotUrl: "https://t.me/your_bot_username"
```

## Бот

Создай бота через @BotFather, получи токен, укажи его в переменных Netlify.
