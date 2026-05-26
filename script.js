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

  /* ── Floating dust particles ───────────────────── */

  var initDust = function () {
    var canvas = document.getElementById("dust-canvas");
    if (!canvas) return;

    var ctx = canvas.getContext("2d");
    var particles = [];
    var W, H;

    var resize = function () {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };

    var createParticle = function () {
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.8 + 0.4,
        speed: Math.random() * 0.15 + 0.03,
        drift: (Math.random() - 0.5) * 0.08,
        opacity: Math.random() * 0.3 + 0.05,
      };
    };

    var count = Math.min(80, Math.floor((W * H) / 12000));
    for (var i = 0; i < count; i++) {
      particles.push(createParticle());
    }

    var animate = function () {
      ctx.clearRect(0, 0, W, H);

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 215, 0, " + p.opacity + ")";
        ctx.fill();

        p.y -= p.speed;
        p.x += p.drift;

        if (p.y < -10) {
          p.y = H + 10;
          p.x = Math.random() * W;
        }
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
      }

      requestAnimationFrame(animate);
    };

    window.addEventListener("resize", resize);
    resize();

    // stagger start
    setTimeout(animate, 600);
  };

  initDust();

  /* ── Coordinates ───────────────────────────────── */

  var initCoordinates = function () {
    var line1 = document.getElementById("coord-line-1");
    var line2 = document.getElementById("coord-line-2");
    if (!line1 || !line2) return;

    var base = { lat: 55.7558, lng: 37.6173 };
    var step = 0.00008;
    var dir = { lat: 1, lng: -1 };

    var pad = function (n, len) {
      var s = n.toFixed(4);
      while (s.length < len) s = " " + s;
      return s;
    };

    var formatLat = function (v) {
      return (v >= 0 ? "N" : "S") + " " + pad(Math.abs(v), 8);
    };

    var formatLng = function (v) {
      return (v >= 0 ? "E" : "W") + " " + pad(Math.abs(v), 8);
    };

    var tick = function () {
      base.lat += step * dir.lat;
      base.lng += step * dir.lng;

      if (base.lat > 55.757 || base.lat < 55.754) dir.lat *= -1;
      if (base.lng > 37.619 || base.lng < 37.615) dir.lng *= -1;

      line1.textContent = formatLat(base.lat);
      line2.textContent = formatLng(base.lng);
    };

    tick();
    setInterval(tick, 2000);

    // blink visibility
    var blink = function () {
      var show = Math.random() > 0.12;
      line1.classList.toggle("vis", show);
      line2.classList.toggle("vis", show);
    };

    blink();
    setInterval(blink, 3000 + Math.random() * 2000);
  };

  initCoordinates();
})();
