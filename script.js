(function () {
  var CONFIG = window.MOTIVATOR_CONFIG || {};
  var DEFAULT_BOT_URL = "https://t.me/YOUR_BOT_USERNAME";

  /* ── Config ─────────────────────────────────────── */

  var setBotLinks = function () {
    var url = CONFIG.telegramBotUrl || DEFAULT_BOT_URL;
    var links = document.querySelectorAll("[data-bot-link]");
    for (var i = 0; i < links.length; i++) {
      links[i].href = url;
      links[i].rel = "noopener";
    }
  };

  var setStat = function (attr, fallback) {
    var el = document.querySelector("[" + attr + "]");
    if (el && Number.isFinite(Number(fallback))) el.textContent = fallback;
  };

  setBotLinks();
  setStat("data-rejected", CONFIG.applicationsRejected);
  setStat("data-reviewed", CONFIG.applicationsReviewedToday);

  /* ── Scroll animations ─────────────────────────── */

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

  var anims = document.querySelectorAll(".anim");
  for (var i = 0; i < anims.length; i++) observer.observe(anims[i]);

  /* ── Scroll blend: image → video ──────────────── */

  var hero = document.querySelector(".hero");
  var media = document.querySelector(".hero-media");
  if (hero && media) {
    var blend = function () {
      var rect = hero.getBoundingClientRect();
      var vh = window.innerHeight;
      var t = (rect.bottom - vh * 0.7) / (-vh - vh * 0.3);
      media.style.opacity = Math.max(0, Math.min(1, 1 - t));
    };
    blend();
    window.addEventListener("scroll", blend, { passive: true });
    window.addEventListener("resize", blend, { passive: true });
  }

  /* ── Coordinates ───────────────────────────────── */

  var c1 = document.getElementById("coord-line-1");
  var c2 = document.getElementById("coord-line-2");
  if (c1 && c2) {
    var lat = 55.7558, lng = 37.6173, dl = 1, dn = -1;

    setInterval(function () {
      lat += 0.00008 * dl; lng += 0.00008 * dn;
      if (lat > 55.757 || lat < 55.754) dl *= -1;
      if (lng > 37.619 || lng < 37.615) dn *= -1;

      var pad = function (v) { var s = Math.abs(v).toFixed(4); while (s.length < 8) s = " " + s; return s; };
      c1.textContent = (lat >= 0 ? "N" : "S") + " " + pad(lat);
      c2.textContent = (lng >= 0 ? "E" : "W") + " " + pad(lng);
    }, 3000);

    setInterval(function () {
      var show = Math.random() > 0.15;
      c1.classList.toggle("vis", show);
      c2.classList.toggle("vis", show);
    }, 4000);
  }

  /* ── Video ping-pong (0→1→0, throttled seeking) ── */

  var video = document.getElementById("bg-video");
  if (video) {
    var started = false;
    var VP = 0, dir = 1;
    var SPEED = 0.006;
    var THROTTLE = 60;
    var last = 0;
    var dur = video.duration || 1;

    var tick = function (now) {
      if (!started || !dur) { requestAnimationFrame(tick); return; }
      if (now - last < THROTTLE) { requestAnimationFrame(tick); return; }
      last = now;
      VP += dir * SPEED;
      if (VP >= 1) { VP = 1; dir = -1; }
      if (VP <= 0) { VP = 0; dir = 1; }
      video.currentTime = VP * dur;
      requestAnimationFrame(tick);
    };

    var boot = function () {
      if (started) return;
      video.play().then(function () {
        started = true;
        dur = video.duration || dur;
        requestAnimationFrame(tick);
      }).catch(function () {
        /* no gesture yet — handlers below will retry */
      });
    };

    /* get duration as soon as possible but don't play yet */
    var metaLoaded = function () { dur = video.duration || dur; };
    if (video.readyState >= 2) { metaLoaded(); }
    else { video.addEventListener("canplay", metaLoaded, { once: true }); }

    /* first user gesture starts the video */
    document.addEventListener("click", boot, { once: true });
    document.addEventListener("touchstart", boot, { once: true });

    /* also try immediately — some browsers allow autoplay */
    boot();
  }
})();
