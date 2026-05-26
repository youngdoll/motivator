import { getStore } from "@netlify/blobs";

/* ── Constants ──────────────────────────────────────── */

const STATUS = Object.freeze({
  NEW: "new",
  ANSWERING: "answering",
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

const COMMANDS = Object.freeze({
  APPROVE: "/approve",
  REJECT: "/reject",
  HELP: "/help",
  ID: "/id",
  START: "/start",
  START_ALT: "start",
});

const CALLBACK_ACTIONS = Object.freeze(["approve", "reject"]);

const METHOD = Object.freeze({
  SEND_MESSAGE: "sendMessage",
});

const ERROR_MESSAGES = Object.freeze({
  BOT_TOKEN: "BOT_TOKEN not configured",
  METHOD_NOT_ALLOWED: "Method not allowed",
});

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

/* ── Environment ────────────────────────────────────── */

const env = {
  botToken: () => process.env.BOT_TOKEN,
  adminChatId: () => process.env.ADMIN_CHAT_ID || "",
  inviteLink: () => process.env.INVITE_LINK || "[ссылка]",
  reportTime: () => process.env.REPORT_TIME || "21:00",
  reapplyDays: () => Number(process.env.REAPPLY_DAYS || 30),
};

/* ── Questions ──────────────────────────────────────── */

const QUESTIONS = Object.freeze([
  {
    id: "identity",
    title: "Вопрос 1 / идентификация",
    text: "Сколько тебе лет и из какого ты города?\n\nФормат: 28, Москва",
  },
  {
    id: "failure",
    title: "Вопрос 2 / конкретный провал",
    text: 'Назови одно дело, которое ты начинал больше двух раз и так и не довел до конца.\n\nКонкретно. Не "развиваться" и не "заняться спортом".\nПроект, продукт, навык, бизнес, документ, тело, деньги.',
  },
  {
    id: "reason",
    title: "Вопрос 3 / настоящая причина",
    text: 'Почему ты его не доделал?\n\nТолько одна причина. Настоящая.\nНе "не было времени".\n\nЧто стояло за этим на самом деле?',
  },
  {
    id: "current_action",
    title: "Вопрос 4 / текущая ситуация",
    text: "Что ты делаешь прямо сейчас, чтобы изменить эту ситуацию?\n\nКонкретные действия.\nЕсли ничего — так и напиши.",
  },
  {
    id: "rules",
    title: "Вопрос 5 / готовность к правилам",
    text: "В канале есть одно обязательное условие: ежедневный отчет в {reportTime} — что конкретно ты сделал за день.\n\nПропуск без предупреждения = выход из активного ядра.\n\nТы готов к этому?\n\nОтветь: Да / Нет / Не уверен",
  },
]);

/* ── Logger ─────────────────────────────────────────── */

const log = {
  error: (context, err) => {
    console.error(
      JSON.stringify({
        level: "error",
        context,
        message: err?.message,
        stack: err?.stack,
      })
    );
  },
};

/* ── Repository ─────────────────────────────────────── */

const createApplicationRepository = (store) => {
  const KEY = "applications";

  const read = async () => {
    try {
      const raw = await store.get(KEY, { type: "text" });
      return raw ? JSON.parse(raw) : { offset: 0, users: {} };
    } catch {
      return { offset: 0, users: {} };
    }
  };

  const save = async (data) => {
    await store.set(KEY, JSON.stringify(data));
  };

  return { read, save };
};

/* ── Telegram API client ────────────────────────────── */

const createTelegramClient = () => {
  const call = async (method, body) => {
    const url = `${TELEGRAM_API_BASE}${env.botToken()}/${method}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.ok) {
      log.error("telegram_api", new Error(`API ${method} failed: ${res.status}`));
    }
    return payload;
  };

  const sendMessage = (chatId, text, extra = {}) =>
    call(METHOD.SEND_MESSAGE, {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      ...extra,
    });

  return { sendMessage };
};

/* ── Copy (messages) ────────────────────────────────── */

const buildCopy = () => {
  const link = env.inviteLink();
  const time = env.reportTime();
  const days = env.reapplyDays();

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
      `Ссылка на канал: ${link}\n\nДействует 24 часа.`,
  };
};

/* ── Application Service ────────────────────────────── */

const createApplicationService = (repo, tg) => {
  const canReapply = (user) => {
    if (!user.rejectedAt) return true;
    const waitMs = env.reapplyDays() * 24 * 60 * 60 * 1000;
    return Date.now() - new Date(user.rejectedAt).getTime() >= waitMs;
  };

  const isAdmin = (chatId) => {
    const admin = env.adminChatId();
    return admin && String(chatId) === String(admin);
  };

  const getOrCreateUser = (db, chatId, from = {}) => {
    if (!db.users[chatId]) {
      db.users[chatId] = {
        chatId,
        status: STATUS.NEW,
        step: 0,
        answers: {},
        username: from.username || "",
        name: [from.first_name, from.last_name].filter(Boolean).join(" "),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return db.users[chatId];
  };

  const askQuestion = async (chatId, index) => {
    const q = QUESTIONS[index];
    const text = q.text.replace("{reportTime}", env.reportTime());
    await tg.sendMessage(chatId, `${q.title}\n\n${text}`);
  };

  const sendApplicationToAdmin = async (chatId, user) => {
    const adminChatId = env.adminChatId();
    if (!adminChatId) return;

    const lines = [
      "Новая заявка.",
      "",
      `ID: ${chatId}`,
      `Username: ${user.username ? "@" + user.username : "нет"}`,
      `Имя: ${user.name || "нет"}`,
      "",
      `1. ${QUESTIONS[0].title}`,
      user.answers.identity || "-",
      "",
      `2. ${QUESTIONS[1].title}`,
      user.answers.failure || "-",
      "",
      `3. ${QUESTIONS[2].title}`,
      user.answers.reason || "-",
      "",
      `4. ${QUESTIONS[3].title}`,
      user.answers.current_action || "-",
      "",
      `5. ${QUESTIONS[4].title}`,
      user.answers.rules || "-",
    ];

    await tg.sendMessage(adminChatId, lines.join("\n"), {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Принять", callback_data: `approve:${chatId}` },
            { text: "Отклонить", callback_data: `reject:${chatId}` },
          ],
        ],
      },
    });
  };

  const startApplication = async (msg) => {
    const chatId = String(msg.chat.id);
    const db = await repo.read();
    const user = getOrCreateUser(db, chatId, msg.from);
    const copy = buildCopy();

    if (user.status === STATUS.PENDING) {
      await tg.sendMessage(chatId, copy.alreadyPending);
      return;
    }
    if (user.status === STATUS.APPROVED) {
      await tg.sendMessage(chatId, copy.alreadyApproved);
      return;
    }
    if (user.status === STATUS.REJECTED && !canReapply(user)) {
      await tg.sendMessage(chatId, copy.rejected);
      return;
    }

    const now = new Date().toISOString();
    user.status = STATUS.ANSWERING;
    user.step = 0;
    user.answers = {};
    user.startedAt = now;
    user.updatedAt = now;
    await repo.save(db);

    await tg.sendMessage(chatId, copy.start);
    await askQuestion(chatId, 0);
  };

  const continueApplication = async (msg) => {
    const chatId = String(msg.chat.id);
    const text = String(msg.text || "").trim();
    const db = await repo.read();
    const user = db.users[chatId];
    const copy = buildCopy();

    if (!user || user.status === STATUS.PENDING) {
      await tg.sendMessage(chatId, copy.alreadyPending);
      return;
    }
    if (user.status === STATUS.APPROVED) {
      await tg.sendMessage(chatId, copy.alreadyApproved);
      return;
    }
    if (user.status !== STATUS.ANSWERING) {
      await tg.sendMessage(
        chatId,
        "Чтобы подать заявку, напиши /start.\n\nБез анкеты входа нет."
      );
      return;
    }
    if (!text) {
      await tg.sendMessage(chatId, "Текстом. Коротко и конкретно.");
      return;
    }

    const question = QUESTIONS[user.step];
    user.answers[question.id] = text;
    user.step += 1;
    user.updatedAt = new Date().toISOString();
    await repo.save(db);

    if (user.step < QUESTIONS.length) {
      await askQuestion(chatId, user.step);
      return;
    }

    await submitApplication(chatId, user, db);
  };

  const submitApplication = async (chatId, user, db) => {
    user.status = STATUS.PENDING;
    user.submittedAt = new Date().toISOString();
    user.updatedAt = user.submittedAt;
    await repo.save(db);

    const copy = buildCopy();
    await tg.sendMessage(chatId, copy.submitted);
    await sendApplicationToAdmin(chatId, user);
  };

  const moderateApplication = async (targetChatId, action) => {
    const db = await repo.read();
    const user = db.users[String(targetChatId)];
    if (!user) return;

    const now = new Date().toISOString();
    const copy = buildCopy();
    const isApproved = action === "approve";

    user.status = isApproved ? STATUS.APPROVED : STATUS.REJECTED;
    if (isApproved) user.approvedAt = now;
    else user.rejectedAt = now;
    user.updatedAt = now;
    await repo.save(db);

    await tg.sendMessage(targetChatId, isApproved ? copy.approved : copy.rejected);
  };

  const handleCallback = async (callback) => {
    const data = String(callback.data || "");
    const fromChatId = String(callback.message?.chat?.id || "");
    if (!isAdmin(fromChatId)) return;

    const [action, targetChatId] = data.split(":");
    if (!targetChatId || !CALLBACK_ACTIONS.includes(action)) return;

    await moderateApplication(targetChatId, action);
  };

  const handleAdminCommand = async (text, action, adminChatId) => {
    const [, targetChatId] = text.split(/\s+/);
    if (!targetChatId) {
      await tg.sendMessage(adminChatId, `Формат: /${action} <telegram_id>`);
      return;
    }

    await moderateApplication(targetChatId, action);

    const msg =
      action === "approve"
        ? "Одобрено. Пользователь получил ссылку."
        : "Отклонено. Пользователь получил сухой отказ.";
    await tg.sendMessage(adminChatId, msg);
  };

  const handleMessage = async (msg) => {
    const chatId = String(msg.chat.id);
    const text = String(msg.text || "").trim();

    if (isAdmin(chatId) && text.startsWith(COMMANDS.APPROVE)) {
      await handleAdminCommand(text, "approve", chatId);
      return;
    }
    if (isAdmin(chatId) && text.startsWith(COMMANDS.REJECT)) {
      await handleAdminCommand(text, "reject", chatId);
      return;
    }
    if (text === COMMANDS.HELP) {
      const helpText = isAdmin(chatId)
        ? [
            "Админ-команды:",
            "/approve <telegram_id> — принять",
            "/reject <telegram_id> — отклонить",
            "",
            "Можно также нажимать кнопки под заявкой.",
          ].join("\n")
        : "Команды: /start — подать заявку.";
      await tg.sendMessage(chatId, helpText);
      return;
    }
    if (text === COMMANDS.ID) {
      await tg.sendMessage(
        chatId,
        `Твой chat id: ${chatId}\n\nУкажи его в переменной ADMIN_CHAT_ID в настройках Netlify.`
      );
      return;
    }
    if (text === COMMANDS.START || text === COMMANDS.START_ALT) {
      await startApplication(msg);
      return;
    }

    await continueApplication(msg);
  };

  return { handleCallback, handleMessage };
};

/* ── Handler factory ────────────────────────────────── */

const createHandler = () => {
  const store = getStore("bot-data");
  const repo = createApplicationRepository(store);
  const tg = createTelegramClient();
  const service = createApplicationService(repo, tg);

  return async (event) => {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: ERROR_MESSAGES.METHOD_NOT_ALLOWED };
    }
    if (!env.botToken()) {
      return { statusCode: 500, body: ERROR_MESSAGES.BOT_TOKEN };
    }

    try {
      const update = JSON.parse(event.body);

      if (update.callback_query) {
        await service.handleCallback(update.callback_query);
      } else if (update.message) {
        await service.handleMessage(update.message);
      }

      return { statusCode: 200, body: "OK" };
    } catch (err) {
      log.error("handler", err);
      return { statusCode: 200, body: "OK" };
    }
  };
};

export const handler = createHandler();
