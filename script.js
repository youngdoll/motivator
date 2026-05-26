(function () {
  var CONFIG = window.MOTIVATOR_CONFIG || {};
  var DEFAULT_BOT_URL = "https://t.me/YOUR_BOT_USERNAME";

  /* ── Bot links ─────────────────────────────────── */

  var ATTRS = {
    BOT_LINK: "data-bot-link",
    REJECTED: "data-rejected",
    REVIEWED: "data-reviewed",
  };

  var setBotLinks = function () {
    var url = CONFIG.telegramBotUrl || DEFAULT_BOT_URL;
    document.querySelectorAll("[" + ATTRS.BOT_LINK + "]").forEach(function (el) {
      el.href = url;
      el.rel = "noopener";
    });
  };

  var setNumericText = function (selector, value) {
    var el = document.querySelector(selector);
    if (el && Number.isFinite(Number(value))) {
      el.textContent = value;
    }
  };

  setBotLinks();
  setNumericText("[" + ATTRS.REJECTED + "]", CONFIG.applicationsRejected);
  setNumericText("[" + ATTRS.REVIEWED + "]", CONFIG.applicationsReviewedToday);

  /* ── Scroll animations ─────────────────────────── */

  var observeAnimations = function () {
    var targets = document.querySelectorAll(".anim");
    if (!targets.length) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    targets.forEach(function (el) {
      observer.observe(el);
    });
  };

  observeAnimations();
})();
