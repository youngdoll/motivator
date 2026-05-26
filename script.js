(function () {
  var CONFIG = window.MOTIVATOR_CONFIG || {};
  var DEFAULT_BOT_URL = "https://t.me/YOUR_BOT_USERNAME";

  /* ── Config ─────────────────────────────────────── */

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
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            entries[i].target.classList.add("in-view");
            observer.unobserve(entries[i].target);
          }
        }
      },
      { threshold: 0.15 }
    );

    for (var i = 0; i < targets.length; i++) {
      observer.observe(targets[i]);
    }
  };

  /* ── Floating dust (lightweight) ───────────────── */

  var initDust = function () {
    var canvas = document.getElementById("dust-canvas");
    if (!canvas) return;

    var ctx = canvas.getContext("2d");
    var particles = [];
    var W, H;
    var animId;

    var resize = function () {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };

    resize();

    var count = Math.min(30, Math.floor((W * H) / 25000));

    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.4 + 0.3,
        speed: Math.random() * 0.12 + 0.02,
        drift: (Math.random() - 0.5) * 0.06,
        opacity: Math.random() * 0.2 + 0.03,
      });
    }

    var animate = function () {
      ctx.clearRect(0, 0, W, H);

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.y -= p.speed;
        p.x += p.drift;

        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 215, 0, " + p.opacity + ")";
        ctx.fill();
      }

      animId = requestAnimationFrame(animate);
    };

    window.addEventListener("resize", resize);
    setTimeout(animate, 800);
  };

  /* ── Coordinates ───────────────────────────────── */

  var initCoordinates = function () {
    var line1 = document.getElementById("coord-line-1");
    var line2 = document.getElementById("coord-line-2");
    if (!line1 || !line2) return;

    var lat = 55.7558, lng = 37.6173;
    var step = 0.00008;
    var dirLat = 1, dirLng = -1;

    var pad = function (n) {
      var s = Math.abs(n).toFixed(4);
      while (s.length < 8) s = " " + s;
      return s;
    };

    var tick = function () {
      lat += step * dirLat;
      lng += step * dirLng;
      if (lat > 55.757 || lat < 55.754) dirLat *= -1;
      if (lng > 37.619 || lng < 37.615) dirLng *= -1;
      line1.textContent = (lat >= 0 ? "N" : "S") + " " + pad(lat);
      line2.textContent = (lng >= 0 ? "E" : "W") + " " + pad(lng);
    };

    tick();
    setInterval(tick, 2500);

    var blink = function () {
      var show = Math.random() > 0.15;
      line1.classList.toggle("vis", show);
      line2.classList.toggle("vis", show);
    };

    blink();
    setInterval(blink, 3500);
  };

  /* ── Ping-pong video ──────────────────────────── */

  var initVideo = function () {
    var video = document.getElementById("bg-video");
    var fallback = document.getElementById("bg-fallback");
    if (!video) return;

    var ready = false;
    var dir = 1;
    var speed = 0.008; // seconds per frame — smooth bidirectional
    var VP = 0; // virtual progress 0..1

    var start = function () {
      video.play().catch(function () {
        if (fallback) fallback.classList.add("show");
      });
    };

    // Wait for metadata, then start ping-pong
    var onReady = function () {
      ready = true;
      var tick = function () {
        if (!ready) { requestAnimationFrame(tick); return; }
        VP += dir * speed;
        if (VP >= 1) { VP = 1; dir = -1; }
        if (VP <= 0) { VP = 0; dir = 1; }
        video.currentTime = VP * video.duration;
        requestAnimationFrame(tick);
      };
      tick();
    };

    if (video.readyState >= 1) { onReady(); }
    else { video.addEventListener("loadedmetadata", onReady, { once: true }); }

    start();
    document.addEventListener("click", start, { once: true });
    document.addEventListener("touchstart", start, { once: true });
  };

  /* ── Scroll-driven image→video transition ────── */

  var initScrollBlend = function () {
    var hero = document.querySelector(".hero");
    var media = document.querySelector(".hero-media");
    if (!hero || !media) return;

    var tick = function () {
      var rect = hero.getBoundingClientRect();
      var vh = window.innerHeight;
      var fadeStart = vh * 0.7;
      var fadeEnd = -vh * 0.3;
      var t = (rect.bottom - fadeStart) / (fadeEnd - fadeStart);
      var opacity = Math.max(0, Math.min(1, 1 - t));
      media.style.opacity = opacity;
    };

    tick();
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick, { passive: true });
  };

  observeAnimations();
  initDust();
  initCoordinates();
  initVideo();
  initScrollBlend();
})();
