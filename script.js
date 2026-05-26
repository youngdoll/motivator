(function () {
  const config = window.MOTIVATOR_CONFIG || {};
  const botUrl = config.telegramBotUrl || "https://t.me/YOUR_BOT_USERNAME";

  document.querySelectorAll("[data-bot-link]").forEach((link) => {
    link.href = botUrl;
    link.rel = "noopener";
  });

  const rejected = document.querySelector("[data-rejected]");
  if (rejected && Number.isFinite(Number(config.applicationsRejected))) {
    rejected.textContent = config.applicationsRejected;
  }

  const reviewed = document.querySelector("[data-reviewed]");
  if (reviewed && Number.isFinite(Number(config.applicationsReviewedToday))) {
    reviewed.textContent = config.applicationsReviewedToday;
  }
})();
