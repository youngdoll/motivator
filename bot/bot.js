"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "applications.json");
const ENV_PATH = path.join(ROOT, ".env");

loadEnv(ENV_PATH);

const CONFIG = {
  token: process.env.BOT_TOKEN,
  adminChatId: process.env.ADMIN_CHAT_ID || "",
  inviteLink: process.env.INVITE_LINK || "[ссылка]",
  reportTime: process.env.REPORT_TIME || "21:00",
  reapplyDays: Number(process.env.REAPPLY_DAYS || 30)
};

if (!CONFIG.token) {
  fail("BOT_TOKEN не задан. Создай bot/.env по примеру bot/.env.example.");
}

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = readDb();
let offset = db.offset || 0;

const questions = [
  {
    id: "identity",
    title: "Вопрос 1 / идентификация",
    text: "Сколько тебе лет и из какого ты города?\n\nФормат: 28, Москва"
  },
  {
    id: "failure",
    title: "Вопрос 2 / конкретный провал",
    text:
      "Назови одно дело, которое ты начинал больше двух раз и так и не довел до конца.\n\n" +
      "Конкретно. Не \"развиваться\" и не \"заняться спортом\".\n" +
      "Проект, продукт, навык, бизнес, документ, тело, деньги."
  },
  {
    id: "reason",
    title: "Вопрос 3 / настоящая причина",
    text:
      "Почему ты его не доделал?\n\n" +
      "Только одна причина. Настоящая.\n" +
      "Не \"не было времени\".\n\n" +
      "Что стояло за этим на самом деле?"
  },
  {
    id: "current_action",
    title: "Вопрос 4 / текущая ситуация",
    text:
      "Что ты делаешь прямо сейчас, чтобы изменить эту ситуацию?\n\n" +
      "Конкретные действия.\n" +
      "Если ничего — так и напиши."
  },
  {
    id: "rules",
    title: "Вопрос 5 / готовность к правилам",
    text:
      `В канале есть одно обязательное условие: ежедневный отчет в ${CONFIG.reportTime} — ` +
      "что конкретно ты сделал за день.\n\n" +
      "Пропуск без предупреждения = выход из активного ядра.\n\n" +
      "Ты готов к этому?\n\n" +
      "Ответь: Да / Нет / Не уверен"
  }
];

const copy = {
  start:
    "Хорошо. Ты здесь.\n\n" +
    "Это не канал для всех.\n" +
    "Это не место, где тебя будут хвалить за попытки.\n\n" +
    "Здесь один стандарт: делаешь или нет.\n\n" +
    "Перед тем как я дам тебе доступ — несколько вопросов.\n" +
    "Отвечай честно. Не для меня. Для себя.\n\n" +
    "Если ответы не пройдут модерацию — ты получишь отказ без объяснений.\n\n" +
    "Начнем.",

  alreadyPending:
    "Твоя заявка уже на проверке.\n\n" +
    "Не надо дергать дверь. Ответ придет после модерации.",

  alreadyApproved:
    `Ты уже принят.\n\nСсылка на канал: ${CONFIG.inviteLink}\n\n` +
    `Первый отчет — сегодня в ${CONFIG.reportTime}. Один пункт. Конкретный.`,

  rejected:
    "Заявка отклонена.\n\n" +
    "Без обид и без объяснений — это часть условий, которые ты принял.\n\n" +
    `Если изменится что-то существенное, можешь подать снова через ${CONFIG.reapplyDays} дней.`,

  submitted:
    "Заявка принята.\n\n" +
    "Если ответы живые — получишь вход.\n" +
    "Если там туман и поза — нет.\n\n" +
    "Проверка до 24 часов.",

  approved:
    "Заявка рассмотрена.\n\n" +
    "Ты принят.\n\n" +
    `Одно условие: первый отчет — сегодня в ${CONFIG.reportTime}.\n` +
    "Что сделал сегодня.\n" +
    "Один пункт. Конкретный.\n\n" +
    "Это твой первый тест.\n\n" +
    `Ссылка на канал: ${CONFIG.inviteLink}\n\n` +
    "Действует 24 часа.",

  declineAdminDone: "Отклонено. Пользователь получил сухой отказ.",
  approveAdminDone: "Одобрено. Пользователь получил ссылку."
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  console.log("Bot started. Polling Telegram API.");

  while (true) {
    try {
      const payload = await api("getUpdates", {
        offset,
        timeout: 25,
        allowed_updates: ["message", "callback_query"]
      });

      for (const update of payload.result || []) {
        offset = update.update_id + 1;
        db.offset = offset;
        saveDb();
        await handleUpdate(update);
      }
    } catch (error) {
      console.error("Polling error:", error.message);
      await wait(1800);
    }
  }
}

async function handleUpdate(update) {
  if (update.callback_query) {
    await handleCallback(update.callback_query);
    return;
  }

  if (!update.message || !update.message.chat) {
    return;
  }

  const message = update.message;
  const chatId = String(message.chat.id);
  const text = String(message.text || "").trim();

  if (isAdmin(chatId) && text.startsWith("/approve")) {
    await handleAdminCommand(text, "approve", chatId);
    return;
  }

  if (isAdmin(chatId) && text.startsWith("/reject")) {
    await handleAdminCommand(text, "reject", chatId);
    return;
  }

  if (text === "/help") {
    await sendMessage(chatId, helpText(chatId));
    return;
  }

  if (text === "/id") {
    await sendMessage(
      chatId,
      `Твой chat id: ${chatId}\n\nВставь его в ADMIN_CHAT_ID в bot/.env.`
    );
    return;
  }

  if (text === "/start" || text === "start") {
    await startApplication(message);
    return;
  }

  await continueApplication(message);
}

async function startApplication(message) {
  const chatId = String(message.chat.id);
  const user = getUser(chatId, message.from);

  if (user.status === "pending") {
    await sendMessage(chatId, copy.alreadyPending);
    return;
  }

  if (user.status === "approved") {
    await sendMessage(chatId, copy.alreadyApproved);
    return;
  }

  if (user.status === "rejected" && !canReapply(user)) {
    await sendMessage(chatId, copy.rejected);
    return;
  }

  user.status = "answering";
  user.step = 0;
  user.answers = {};
  user.startedAt = new Date().toISOString();
  user.updatedAt = user.startedAt;
  saveDb();

  await sendMessage(chatId, copy.start);
  await askQuestion(chatId, user.step);
}

async function continueApplication(message) {
  const chatId = String(message.chat.id);
  const text = String(message.text || "").trim();
  const user = getUser(chatId, message.from);

  if (user.status === "pending") {
    await sendMessage(chatId, copy.alreadyPending);
    return;
  }

  if (user.status === "approved") {
    await sendMessage(chatId, copy.alreadyApproved);
    return;
  }

  if (user.status !== "answering") {
    await sendMessage(
      chatId,
      "Чтобы подать заявку, напиши /start.\n\nБез анкеты входа нет."
    );
    return;
  }

  if (!text) {
    await sendMessage(chatId, "Текстом. Коротко и конкретно.");
    return;
  }

  const question = questions[user.step];
  user.answers[question.id] = text;
  user.step += 1;
  user.updatedAt = new Date().toISOString();
  saveDb();

  if (user.step < questions.length) {
    await askQuestion(chatId, user.step);
    return;
  }

  await submitApplication(chatId, user);
}

async function askQuestion(chatId, index) {
  const question = questions[index];
  await sendMessage(chatId, `${question.title}\n\n${question.text}`);
}

async function submitApplication(chatId, user) {
  user.status = "pending";
  user.submittedAt = new Date().toISOString();
  user.updatedAt = user.submittedAt;
  saveDb();

  await sendMessage(chatId, copy.submitted);
  await sendApplicationToAdmin(chatId, user);
}

async function sendApplicationToAdmin(chatId, user) {
  if (!CONFIG.adminChatId) {
    await sendMessage(
      chatId,
      "Заявка собрана, но ADMIN_CHAT_ID еще не настроен.\n\nНапиши боту /id, вставь chat id в bot/.env и перезапусти бота."
    );
    return;
  }

  const lines = [
    "Новая заявка.",
    "",
    `ID: ${chatId}`,
    `Username: ${user.username ? "@" + user.username : "нет"}`,
    `Имя: ${user.name || "нет"}`,
    "",
    `1. ${questions[0].title}`,
    user.answers.identity || "-",
    "",
    `2. ${questions[1].title}`,
    user.answers.failure || "-",
    "",
    `3. ${questions[2].title}`,
    user.answers.reason || "-",
    "",
    `4. ${questions[3].title}`,
    user.answers.current_action || "-",
    "",
    `5. ${questions[4].title}`,
    user.answers.rules || "-"
  ];

  await sendMessage(CONFIG.adminChatId, lines.join("\n"), {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Принять", callback_data: `approve:${chatId}` },
          { text: "Отклонить", callback_data: `reject:${chatId}` }
        ]
      ]
    }
  });
}

async function handleCallback(callback) {
  const data = String(callback.data || "");
  const fromChatId = String(callback.message?.chat?.id || "");

  if (!isAdmin(fromChatId)) {
    await api("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: "Нет доступа."
    });
    return;
  }

  const [action, targetChatId] = data.split(":");
  if (!targetChatId || !["approve", "reject"].includes(action)) {
    return;
  }

  await moderateApplication(targetChatId, action);
  await api("answerCallbackQuery", {
    callback_query_id: callback.id,
    text: action === "approve" ? "Принято" : "Отклонено"
  });
}

async function handleAdminCommand(text, action, adminChatId) {
  const [, targetChatId] = text.split(/\s+/);
  if (!targetChatId) {
    await sendMessage(adminChatId, `Формат: /${action} <telegram_id>`);
    return;
  }

  await moderateApplication(targetChatId, action);
  await sendMessage(
    adminChatId,
    action === "approve" ? copy.approveAdminDone : copy.declineAdminDone
  );
}

async function moderateApplication(chatId, action) {
  const user = db.users[String(chatId)];
  if (!user) {
    await sendMessage(CONFIG.adminChatId, `Пользователь ${chatId} не найден.`);
    return;
  }

  const now = new Date().toISOString();
  if (action === "approve") {
    user.status = "approved";
    user.approvedAt = now;
    user.updatedAt = now;
    saveDb();
    await sendMessage(chatId, copy.approved);
    return;
  }

  user.status = "rejected";
  user.rejectedAt = now;
  user.updatedAt = now;
  saveDb();
  await sendMessage(chatId, copy.rejected);
}

function getUser(chatId, from = {}) {
  if (!db.users[chatId]) {
    db.users[chatId] = {
      chatId,
      status: "new",
      step: 0,
      answers: {},
      username: from.username || "",
      name: [from.first_name, from.last_name].filter(Boolean).join(" "),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  } else {
    db.users[chatId].username = from.username || db.users[chatId].username || "";
    db.users[chatId].name =
      [from.first_name, from.last_name].filter(Boolean).join(" ") ||
      db.users[chatId].name ||
      "";
  }

  return db.users[chatId];
}

function canReapply(user) {
  if (!user.rejectedAt) {
    return true;
  }

  const rejectedAt = new Date(user.rejectedAt).getTime();
  const waitMs = CONFIG.reapplyDays * 24 * 60 * 60 * 1000;
  return Date.now() - rejectedAt >= waitMs;
}

function helpText(chatId) {
  if (!isAdmin(chatId)) {
    return "Команды: /start — подать заявку.";
  }

  return [
    "Админ-команды:",
    "/approve <telegram_id> — принять",
    "/reject <telegram_id> — отклонить",
    "",
    "Можно также нажимать кнопки под заявкой."
  ].join("\n");
}

function isAdmin(chatId) {
  if (!CONFIG.adminChatId) {
    return false;
  }

  return String(chatId) === String(CONFIG.adminChatId);
}

async function sendMessage(chatId, text, extra = {}) {
  return api("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...extra
  });
}

async function api(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${CONFIG.token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(
      `Telegram API ${method} failed: ${response.status} ${JSON.stringify(payload)}`
    );
  }

  return payload;
}

function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    return { offset: 0, users: {} };
  }

  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    fail(`Не смог прочитать ${DB_PATH}: ${error.message}`);
  }
}

function saveDb() {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
