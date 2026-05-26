import { getStore } from '@netlify/blobs';

const questions = [
  {
    id: "identity",
    title: "Вопрос 1 / идентификация",
    text: "Сколько тебе лет и из какого ты города?\n\nФормат: 28, Москва"
  },
  {
    id: "failure",
    title: "Вопрос 2 / конкретный провал",
    text: 'Назови одно дело, которое ты начинал больше двух раз и так и не довел до конца.\n\nКонкретно. Не "развиваться" и не "заняться спортом".\nПроект, продукт, навык, бизнес, документ, тело, деньги.'
  },
  {
    id: "reason",
    title: "Вопрос 3 / настоящая причина",
    text: 'Почему ты его не доделал?\n\nТолько одна причина. Настоящая.\nНе "не было времени".\n\nЧто стояло за этим на самом деле?'
  },
  {
    id: "current_action",
    title: "Вопрос 4 / текущая ситуация",
    text: "Что ты делаешь прямо сейчас, чтобы изменить эту ситуацию?\n\nКонкретные действия.\nЕсли ничего — так и напиши."
  },
  {
    id: "rules",
    title: "Вопрос 5 / готовность к правилам",
    text: "В канале есть одно обязательное условие: ежедневный отчет в {reportTime} — что конкретно ты сделал за день.\n\nПропуск без предупреждения = выход из активного ядра.\n\nТы готов к этому?\n\nОтветь: Да / Нет / Не уверен"
  }
];

const BOT_TOKEN = () => process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = () => process.env.ADMIN_CHAT_ID || "";
const INVITE_LINK = () => process.env.INVITE_LINK || "[ссылка]";
const REPORT_TIME = () => process.env.REPORT_TIME || "21:00";
const REAPPLY_DAYS = () => Number(process.env.REAPPLY_DAYS || 30);

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  if (!BOT_TOKEN()) {
    return { statusCode: 500, body: "BOT_TOKEN not configured" };
  }

  try {
    const update = JSON.parse(event.body);
    const store = getStore("bot-data");
    await handleUpdate(update, store);
    return { statusCode: 200, body: "OK" };
  } catch (err) {
    console.error("Handler error:", err);
    return { statusCode: 200, body: "OK" };
  }
};

async function handleUpdate(update, store) {
  if (update.callback_query) {
    await handleCallback(update.callback_query, store);
    return;
  }

  if (!update.message || !update.message.chat) return;

  const msg = update.message;
  const chatId = String(msg.chat.id);
  const text = String(msg.text || "").trim();

  if (isAdmin(chatId) && text.startsWith("/approve")) {
    await handleAdminCommand(text, "approve", chatId, store);
    return;
  }
  if (isAdmin(chatId) && text.startsWith("/reject")) {
    await handleAdminCommand(text, "reject", chatId, store);
    return;
  }
  if (text === "/help") {
    await sendMessage(chatId, helpText(chatId));
    return;
  }
  if (text === "/id") {
    await sendMessage(chatId, `Твой chat id: ${chatId}\n\nУкажи его в переменной ADMIN_CHAT_ID в настройках Netlify.`);
    return;
  }
  if (text === "/start" || text === "start") {
    await startApplication(msg, store);
    return;
  }
  await continueApplication(msg, store);
}

async function handleCallback(callback, store) {
  const data = String(callback.data || "");
  const fromChatId = String(callback.message?.chat?.id || "");
  if (!isAdmin(fromChatId)) return;
  const [action, targetChatId] = data.split(":");
  if (!targetChatId || !["approve", "reject"].includes(action)) return;
  await moderateApplication(targetChatId, action, store);
}

async function handleAdminCommand(text, action, adminChatId, store) {
  const [, targetChatId] = text.split(/\s+/);
  if (!targetChatId) {
    await sendMessage(adminChatId, `Формат: /${action} <telegram_id>`);
    return;
  }
  await moderateApplication(targetChatId, action, store);
  const msg = action === "approve" ? "Одобрено. Пользователь получил ссылку." : "Отклонено. Пользователь получил сухой отказ.";
  await sendMessage(adminChatId, msg);
}

async function moderateApplication(chatId, action, store) {
  const db = await readDb(store);
  const user = db.users[String(chatId)];
  if (!user) return;

  const now = new Date().toISOString();
  if (action === "approve") {
    user.status = "approved";
    user.approvedAt = now;
    user.updatedAt = now;
    await saveDb(store, db);
    await sendMessage(chatId, getCopy().approved);
  } else {
    user.status = "rejected";
    user.rejectedAt = now;
    user.updatedAt = now;
    await saveDb(store, db);
    await sendMessage(chatId, getCopy().rejected);
  }
}

async function startApplication(msg, store) {
  const chatId = String(msg.chat.id);
  const db = await readDb(store);
  const user = getUser(db, chatId, msg.from);

  if (user.status === "pending") {
    await sendMessage(chatId, getCopy().alreadyPending);
    return;
  }
  if (user.status === "approved") {
    await sendMessage(chatId, getCopy().alreadyApproved);
    return;
  }
  if (user.status === "rejected" && !canReapply(user)) {
    await sendMessage(chatId, getCopy().rejected);
    return;
  }

  user.status = "answering";
  user.step = 0;
  user.answers = {};
  user.startedAt = new Date().toISOString();
  user.updatedAt = user.startedAt;
  await saveDb(store, db);

  await sendMessage(chatId, getCopy().start);
  await askQuestion(chatId, 0);
}

async function continueApplication(msg, store) {
  const chatId = String(msg.chat.id);
  const text = String(msg.text || "").trim();
  const db = await readDb(store);
  const user = db.users[chatId];

  if (!user || user.status === "pending") {
    await sendMessage(chatId, getCopy().alreadyPending);
    return;
  }
  if (user.status === "approved") {
    await sendMessage(chatId, getCopy().alreadyApproved);
    return;
  }
  if (user.status !== "answering") {
    await sendMessage(chatId, "Чтобы подать заявку, напиши /start.\n\nБез анкеты входа нет.");
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
  await saveDb(store, db);

  if (user.step < questions.length) {
    await askQuestion(chatId, user.step);
    return;
  }

  await submitApplication(chatId, user, db, store);
}

async function askQuestion(chatId, index) {
  const q = questions[index];
  const text = q.text.replace("{reportTime}", REPORT_TIME());
  await sendMessage(chatId, `${q.title}\n\n${text}`);
}

async function submitApplication(chatId, user, db, store) {
  user.status = "pending";
  user.submittedAt = new Date().toISOString();
  user.updatedAt = user.submittedAt;
  await saveDb(store, db);

  await sendMessage(chatId, getCopy().submitted);
  await sendApplicationToAdmin(chatId, user);
}

async function sendApplicationToAdmin(chatId, user) {
  if (!ADMIN_CHAT_ID()) return;

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

  await sendMessage(ADMIN_CHAT_ID(), lines.join("\n"), {
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

function getUser(db, chatId, from = {}) {
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
  }
  return db.users[chatId];
}

function canReapply(user) {
  if (!user.rejectedAt) return true;
  const waitMs = REAPPLY_DAYS() * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(user.rejectedAt).getTime() >= waitMs;
}

function isAdmin(chatId) {
  return ADMIN_CHAT_ID() && String(chatId) === String(ADMIN_CHAT_ID());
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

function getCopy() {
  const link = INVITE_LINK();
  const time = REPORT_TIME();
  const days = REAPPLY_DAYS();

  return {
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
      "Твоя заявка уже на проверке.\n\nНе надо дергать дверь. Ответ придет после модерации.",

    alreadyApproved:
      `Ты уже принят.\n\nСсылка на канал: ${link}\n\nПервый отчет — сегодня в ${time}. Один пункт. Конкретный.`,

    rejected:
      "Заявка отклонена.\n\nБез обид и без объяснений — это часть условий, которые ты принял.\n\n" +
      `Если изменится что-то существенное, можешь подать снова через ${days} дней.`,

    submitted:
      "Заявка принята.\n\nЕсли ответы живые — получишь вход.\nЕсли там туман и поза — нет.\n\nПроверка до 24 часов.",

    approved:
      "Заявка рассмотрена.\n\nТы принят.\n\n" +
      `Одно условие: первый отчет — сегодня в ${time}.\n` +
      "Что сделал сегодня.\nОдин пункт. Конкретный.\n\n" +
      "Это твой первый тест.\n\n" +
      `Ссылка на канал: ${link}\n\nДействует 24 часа.`
  };
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
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
  const url = `https://api.telegram.org/bot${BOT_TOKEN()}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.ok) {
    console.error(`Telegram API ${method} failed:`, res.status, JSON.stringify(payload));
  }
  return payload;
}

async function readDb(store) {
  try {
    const raw = await store.get("applications", { type: "text" });
    return raw ? JSON.parse(raw) : { offset: 0, users: {} };
  } catch {
    return { offset: 0, users: {} };
  }
}

async function saveDb(store, data) {
  await store.set("applications", JSON.stringify(data));
}
