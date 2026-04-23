/* ──────────────────────────────────────────────────────────────
   RunVault site script. Each section is an independent IIFE that
   no-ops when its root element isn't on the current page.
   ────────────────────────────────────────────────────────────── */

/* THEME TOGGLE ──────────────────────────────────────────────── */
(function () {
  "use strict";
  const KEY = "runvault:theme";
  const root = document.documentElement;

  function apply(theme) { root.setAttribute("data-theme", theme); }
  function current() {
    return root.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = current() === "dark" ? "light" : "dark";
      apply(next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
    });
  });
  // Dark is the product default. We intentionally do not follow the OS.
})();

/* SCROLL REVEAL ─────────────────────────────────────────────── */
(function () {
  "use strict";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const targets = document.querySelectorAll(".reveal");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const delay = el.dataset.revealDelay
            ? parseInt(el.dataset.revealDelay, 10)
            : i * 60;
          el.style.setProperty("--reveal-delay", delay + "ms");
          el.classList.add("is-visible");
          io.unobserve(el);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  targets.forEach((el) => io.observe(el));
})();

/* TOKEN-FLOW BACKGROUND ─────────────────────────────────────── */
(function () {
  "use strict";
  const svg = document.querySelector("svg.token-flow");
  if (!svg) return;

  const NS = "http://www.w3.org/2000/svg";
  const LINE_COUNT = 14;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function makePath(w, h, i) {
    const startY = (h / (LINE_COUNT - 1)) * i + (((i * 37) % 80) - 40);
    const endY = startY + (((i * 53) % 160) - 80);
    const cp1x = w * 0.28 + (((i * 19) % 80) - 40);
    const cp1y = startY + (((i * 23) % 120) - 60);
    const cp2x = w * 0.72 + (((i * 31) % 80) - 40);
    const cp2y = endY + (((i * 29) % 120) - 60);
    return `M -40 ${startY.toFixed(1)} C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${(w + 40).toFixed(1)} ${endY.toFixed(1)}`;
  }

  function build() {
    const w = window.innerWidth;
    const h = Math.max(window.innerHeight, document.documentElement.scrollHeight);

    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.innerHTML = "";

    for (let i = 0; i < LINE_COUNT; i++) {
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", makePath(w, h, i));
      const isAccent = i % 3 === 0;
      path.style.stroke = `var(--token-line${isAccent ? "" : "-faint"})`;
      path.setAttribute("stroke-width", isAccent ? "1" : "0.8");
      const dashLen = 2 + (i % 3);
      const gap = 8 + ((i * 3) % 10);
      path.setAttribute("stroke-dasharray", `${dashLen} ${gap}`);
      if (!reduceMotion) {
        const dur = 6 + ((i * 1.3) % 8);
        path.style.animationDuration = dur + "s";
        path.style.animationDelay = `-${(i * 0.6) % 4}s`;
      }
      svg.appendChild(path);
    }
  }

  build();

  let lastW = window.innerWidth;
  let lastH = document.documentElement.scrollHeight;
  let rebuildTimer = null;

  window.addEventListener("resize", () => {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      const w = window.innerWidth;
      const h = document.documentElement.scrollHeight;
      if (Math.abs(w - lastW) > 20 || Math.abs(h - lastH) > 200) {
        lastW = w; lastH = h; build();
      }
    }, 200);
  });

  window.addEventListener("load", () => {
    const h = document.documentElement.scrollHeight;
    if (Math.abs(h - lastH) > 200) { lastH = h; build(); }
  });
})();

/* MONITOR WIDGET (gauge, 7-seg, LEDs, console) ──────────────── */
(function () {
  "use strict";
  const root = document.querySelector("[data-money-counter]");
  if (!root) return;

  const segDisplay   = root.querySelector("[data-seg-display]");
  const barEl        = root.querySelector("[data-counter-bar]");
  const statusEl     = root.querySelector("[data-counter-status]");
  const statusText   = statusEl.querySelector(".counter-status-text");
  const eventsEl     = root.querySelector("[data-counter-events]");
  const gaugeFg      = root.querySelector("[data-gauge-fg]");
  const gaugeNeedle  = root.querySelector("[data-gauge-needle]");
  const readoutPct   = root.querySelector("[data-readout-pct]");
  const readoutRem   = root.querySelector("[data-readout-remaining]");
  const consoleCmd   = root.querySelector("[data-console]");
  const indicators   = {
    auth: root.querySelector('[data-indicator="auth"]'),
    gate: root.querySelector('[data-indicator="gate"]'),
    rail: root.querySelector('[data-indicator="rail"]'),
    kya:  root.querySelector('[data-indicator="kya"]'),
  };

  const CAP = 500;
  const WARN_AT   = 0.6;
  const DANGER_AT = 0.85;
  const GAUGE_ARC = 267;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const SEG_MAP = {
    "0": "abcdef", "1": "bc", "2": "abdeg", "3": "abcdg", "4": "bcfg",
    "5": "acdfg", "6": "acdefg", "7": "abc", "8": "abcdefg", "9": "abcdfg",
    " ": "", "-": "g",
  };
  const SEG_POINTS = {
    a: "7,3 33,3 37,5 33,7 7,7 3,5",
    b: "35,7 37,9 37,31 35,33 33,31 33,9",
    c: "35,37 37,39 37,61 35,63 33,61 33,39",
    d: "7,63 33,63 37,65 33,67 7,67 3,65",
    e: "5,37 7,39 7,61 5,63 3,61 3,39",
    f: "5,7 7,9 7,31 5,33 3,31 3,9",
    g: "7,33 33,33 37,35 33,37 7,37 3,35",
  };

  function makeDigit() {
    const wrap = document.createElement("span");
    wrap.className = "seg-digit";
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 40 70");
    ["a","b","c","d","e","f","g"].forEach((k) => {
      const poly = document.createElementNS(NS, "polygon");
      poly.setAttribute("points", SEG_POINTS[k]);
      poly.dataset.seg = k;
      svg.appendChild(poly);
    });
    wrap.appendChild(svg);
    return wrap;
  }

  function setDigit(el, char) {
    const active = SEG_MAP[char] || "";
    el.querySelectorAll("polygon").forEach((p) => {
      p.classList.toggle("is-on", active.includes(p.dataset.seg));
    });
  }

  function buildDisplay() {
    segDisplay.innerHTML = "";
    const currency = document.createElement("span");
    currency.className = "seg-currency";
    currency.textContent = "$";
    segDisplay.appendChild(currency);

    const digits = [];
    for (let i = 0; i < 3; i++) digits.push(makeDigit());
    const dot = document.createElement("span");
    dot.className = "seg-dot";
    segDisplay.appendChild(digits[0]);
    segDisplay.appendChild(digits[1]);
    segDisplay.appendChild(digits[2]);
    segDisplay.appendChild(dot);
    for (let i = 0; i < 2; i++) {
      const d = makeDigit();
      segDisplay.appendChild(d);
      digits.push(d);
    }
    return digits;
  }

  const digitEls = buildDisplay();

  function formatChars(v) {
    const padded = Math.max(0, v).toFixed(2).padStart(6, "0");
    const parts = padded.split(".");
    const whole = parts[0];
    const frac = parts[1];
    let out = "";
    let seenNonZero = false;
    for (let i = 0; i < whole.length; i++) {
      const c = whole[i];
      if (!seenNonZero && c === "0" && i < whole.length - 1) {
        out += " ";
      } else {
        seenNonZero = true;
        out += c;
      }
    }
    return (out + frac).split("");
  }

  function setValue(v) {
    const safe = Math.max(0, v);
    const chars = formatChars(safe);
    for (let i = 0; i < digitEls.length; i++) setDigit(digitEls[i], chars[i] || " ");

    const pct = Math.max(0, Math.min(100, (safe / CAP) * 100));
    barEl.style.width = pct + "%";
    const angle = -90 + (pct / 100) * 180;
    gaugeNeedle.setAttribute("transform", `rotate(${angle.toFixed(2)} 110 115)`);
    gaugeFg.style.strokeDashoffset = (GAUGE_ARC * (1 - pct / 100)).toFixed(2);
    readoutPct.textContent = Math.round(pct) + "%";
    readoutRem.textContent = Math.max(0, CAP - safe).toFixed(2) + " LEFT";
  }

  function setState(state) {
    if (state) {
      root.setAttribute("data-state", state);
      statusEl.setAttribute("data-state", state);
      barEl.setAttribute("data-state", state);
    } else {
      root.removeAttribute("data-state");
      statusEl.removeAttribute("data-state");
      barEl.removeAttribute("data-state");
    }
    applyLeds(state);
  }

  function applyLeds(state) {
    if (state === "blocked") {
      indicators.auth.dataset.led = "danger";
      indicators.gate.dataset.led = "danger";
      indicators.rail.dataset.led = "danger";
      indicators.kya.dataset.led  = "blink";
    } else if (state === "danger") {
      indicators.auth.dataset.led = "on";
      indicators.gate.dataset.led = "warn";
      indicators.rail.dataset.led = "warn";
      indicators.kya.dataset.led  = "on";
    } else {
      indicators.auth.dataset.led = "on";
      indicators.gate.dataset.led = "on";
      indicators.rail.dataset.led = "on";
      indicators.kya.dataset.led  = "on";
    }
  }

  function addEvent(text, variant) {
    const el = document.createElement("span");
    el.className = "counter-event" + (variant ? " is-" + variant : "");
    el.textContent = text;
    eventsEl.appendChild(el);
    while (eventsEl.children.length > 3) eventsEl.removeChild(eventsEl.firstChild);
  }

  if (reduceMotion) {
    setValue(CAP);
    setState("blocked");
    statusText.textContent = "gate fired · authority exhausted";
    addEvent("GATE FIRED", "blocked");
    return;
  }

  let target = 0;
  let current = 0;
  let stage = null;
  let raf = null;
  let running = false;

  const txSequence = [
    { delta: 12.40,  label: "llm · claude-opus · $12.40",     cmd: "authorize_spend $12.40 --scope llm" },
    { delta: 7.10,   label: "llm · claude-opus · $7.10",      cmd: "authorize_spend $7.10 --scope llm" },
    { delta: 29.99,  label: "purchase · amazon.com · $29.99", cmd: "authorize_spend $29.99 --merchant amazon.com" },
    { delta: 48.20,  label: "purchase · stripe · $48.20",     cmd: "authorize_spend $48.20 --merchant stripe" },
    { delta: 22.00,  label: "llm · gpt-4 · $22.00",           cmd: "authorize_spend $22.00 --scope llm" },
    { delta: 56.75,  label: "purchase · shopify · $56.75",    cmd: "authorize_spend $56.75 --merchant shopify" },
    { delta: 73.30,  label: "llm · claude-opus · $73.30",     cmd: "authorize_spend $73.30 --scope llm" },
    { delta: 64.10,  label: "purchase · uber · $64.10",       cmd: "authorize_spend $64.10 --merchant uber" },
    { delta: 88.00,  label: "purchase · airbnb · $88.00",     cmd: "authorize_spend $88.00 --merchant airbnb" },
    { delta: 95.20,  label: "purchase · delta · $95.20",      cmd: "authorize_spend $95.20 --merchant delta" },
    { delta: 120.00, label: "purchase · hotel · $120.00",     cmd: "authorize_spend $120.00 --merchant marriott" },
  ];

  const DEFAULT_CMD = "runvault monitor --agent research-agent-01 --stream events";

  function setConsole(text, ttl) {
    if (!consoleCmd) return;
    consoleCmd.textContent = text;
    if (ttl) {
      clearTimeout(setConsole._t);
      setConsole._t = setTimeout(() => { consoleCmd.textContent = DEFAULT_CMD; }, ttl);
    }
  }

  function scheduleNextTx(i) {
    if (!running) return;
    if (i >= txSequence.length) return;

    const tx = txSequence[i];
    const prospective = current + tx.delta;
    if (prospective > CAP) { fireGate(tx); return; }

    target = prospective;
    const variant =
      target / CAP >= DANGER_AT ? "danger" :
      target / CAP >= WARN_AT   ? "warn"   : null;
    addEvent("+ " + tx.label, variant);
    setConsole("$ runvault " + tx.cmd + " ✓");

    animateTo(target, () => {
      updateStage();
      setTimeout(() => scheduleNextTx(i + 1), stage === "danger" ? 800 : 500);
    });
  }

  function animateTo(to, done) {
    const from = current;
    const dur = Math.max(300, 600 + Math.min(400, Math.abs(to - from) * 6));
    const start = performance.now();
    function step(now) {
      const t = Math.max(0, Math.min(1, (now - start) / dur));
      const eased = 1 - Math.pow(1 - t, 3);
      current = Math.max(0, from + (to - from) * eased);
      setValue(current);
      updateStage();
      if (t < 1 && running) {
        raf = requestAnimationFrame(step);
      } else {
        current = to;
        setValue(current);
        if (done) done();
      }
    }
    raf = requestAnimationFrame(step);
  }

  function updateStage() {
    const pct = current / CAP;
    let next = null;
    if (pct >= DANGER_AT) next = "danger";
    else if (pct >= WARN_AT) next = "warn";
    if (next !== stage) {
      stage = next;
      setState(stage);
      statusText.textContent =
        stage === "danger" ? "approaching cap" :
        stage === "warn"   ? "elevated"        :
                             "monitoring";
    }
  }

  function fireGate(tx) {
    stage = "blocked";
    setState("blocked");
    statusText.textContent = "gate fired · authority exhausted";
    addEvent("BLOCKED · " + tx.label, "blocked");
    setConsole("$ runvault " + tx.cmd + " ✗ DENIED");
    setTimeout(resetRun, 2800);
  }

  function resetRun() {
    if (!running) return;
    current = 0; target = 0; stage = null;
    setValue(0); setState(null);
    statusText.textContent = "monitoring";
    eventsEl.innerHTML = "";
    addEvent("new run · research-agent-01", null);
    setConsole(DEFAULT_CMD);
    setTimeout(() => scheduleNextTx(0), 700);
  }

  function start() {
    if (running) return;
    running = true;
    setValue(0); setState(null);
    addEvent("new run · research-agent-01", null);
    setConsole(DEFAULT_CMD);
    setTimeout(() => scheduleNextTx(0), 500);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
  }

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => (e.isIntersecting ? start() : stop())),
      { threshold: 0.25 }
    );
    io.observe(root);
  } else {
    start();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (root.getBoundingClientRect().top < window.innerHeight) start();
  });

  setValue(0);
  applyLeds(null);
})();

/* FLOW DIAGRAM rail rotation ────────────────────────────────── */
(function () {
  "use strict";
  const flow = document.querySelector("[data-flow]");
  if (!flow) return;

  const rails = flow.querySelectorAll(".flow-rail");
  const branches = flow.querySelectorAll(".flow-branch");
  if (!rails.length) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    rails[0].classList.add("is-active");
    if (branches[0]) branches[0].classList.add("is-active");
    return;
  }

  let idx = 0;
  let timer = null;

  function step() {
    rails.forEach((r, i) => r.classList.toggle("is-active", i === idx));
    branches.forEach((b) => {
      const i = parseInt(b.dataset.rail, 10);
      b.classList.toggle("is-active", i === idx);
    });
    idx = (idx + 1) % rails.length;
  }

  function start() {
    if (timer) return;
    step();
    timer = setInterval(step, 1500);
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => (e.isIntersecting ? start() : stop())),
      { threshold: 0.15 }
    );
    io.observe(flow);
  } else {
    start();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (flow.getBoundingClientRect().top < window.innerHeight) start();
  });
})();

/* CAROUSEL ──────────────────────────────────────────────────── */
(function () {
  "use strict";
  const carousels = document.querySelectorAll("[data-carousel]");
  if (!carousels.length) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const AUTO_MS = 6500;

  carousels.forEach(init);

  function init(root) {
    const track = root.querySelector("[data-carousel-track]");
    const slides = Array.from(track.querySelectorAll(".carousel-slide"));
    const dotsContainer = root.querySelector("[data-carousel-dots]");
    const prevBtn = root.querySelector("[data-carousel-prev]");
    const nextBtn = root.querySelector("[data-carousel-next]");
    if (!slides.length) return;

    let index = 0;
    let auto = null;

    const dots = slides.map((_, i) => {
      const d = document.createElement("button");
      d.className = "carousel-dot";
      d.type = "button";
      d.setAttribute("role", "tab");
      d.setAttribute("aria-label", `Go to slide ${i + 1} of ${slides.length}`);
      d.addEventListener("click", () => { go(i); restart(); });
      dotsContainer.appendChild(d);
      return d;
    });

    function render() {
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((d, i) => {
        d.classList.toggle("is-active", i === index);
        d.setAttribute("aria-selected", i === index ? "true" : "false");
      });
      slides.forEach((s, i) => {
        s.setAttribute("aria-hidden", i === index ? "false" : "true");
      });
    }

    function go(i) {
      index = ((i % slides.length) + slides.length) % slides.length;
      render();
    }
    function next() { go(index + 1); }
    function prev() { go(index - 1); }

    prevBtn.addEventListener("click", () => { prev(); restart(); });
    nextBtn.addEventListener("click", () => { next(); restart(); });

    function start() {
      if (auto || reduceMotion) return;
      auto = setInterval(next, AUTO_MS);
    }
    function stop() { if (auto) { clearInterval(auto); auto = null; } }
    function restart() { stop(); start(); }

    root.addEventListener("mouseenter", stop);
    root.addEventListener("mouseleave", start);
    root.addEventListener("focusin", stop);
    root.addEventListener("focusout", start);

    root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft")  { e.preventDefault(); prev(); restart(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); next(); restart(); }
    });

    // Basic touch swipe
    let touchX = null;
    track.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener("touchend", (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) < 40) return;
      if (dx < 0) next(); else prev();
      restart();
    });

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => entries.forEach((e) => (e.isIntersecting ? start() : stop())),
        { threshold: 0.25 }
      );
      io.observe(root);
    } else {
      start();
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
      else if (root.getBoundingClientRect().top < window.innerHeight) start();
    });

    render();
  }
})();

/* UPDATES PAGE: markdown-driven timeline ────────────────────── */
(function () {
  "use strict";
  const listEl = document.querySelector("[data-updates]");
  if (!listEl) return;

  const MD_URL = "content/updates.md";
  const MARKED_URL = "https://cdn.jsdelivr.net/npm/marked@12/marked.min.js";
  const PURIFY_URL = "https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js";

  const HEADER = /^##\s+(\d{4}-\d{2}-\d{2})\s*(?:[—\-–:]\s*)?(.*)$/;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) { existing.addEventListener("load", resolve); return; }
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("failed to load " + src));
      document.head.appendChild(s);
    });
  }

  function parseSections(md) {
    const lines = md.split(/\r?\n/);
    const out = [];
    let current = null;
    for (const line of lines) {
      const m = line.match(HEADER);
      if (m) {
        if (current) out.push(current);
        current = { date: m[1], title: m[2].trim(), body: "" };
      } else if (current) {
        current.body += line + "\n";
      }
    }
    if (current) out.push(current);
    out.sort((a, b) => (a.date < b.date ? 1 : -1));
    return out;
  }

  function formatDate(iso) {
    const d = new Date(iso + "T00:00:00Z");
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
    });
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  function render(sections) {
    if (!sections.length) {
      listEl.innerHTML = `<div class="updates-empty">No updates yet. Check back soon.</div>`;
      return;
    }
    listEl.innerHTML = "";
    sections.forEach((s, i) => {
      const article = document.createElement("article");
      article.className = "update reveal is-visible";
      article.style.setProperty("--reveal-delay", i * 60 + "ms");

      const dateEl = document.createElement("div");
      dateEl.className = "update-date";
      dateEl.textContent = formatDate(s.date);

      const bodyEl = document.createElement("div");
      bodyEl.className = "update-body";
      const titleHtml = s.title ? `<h3>${escapeHtml(s.title)}</h3>` : "";
      const bodyHtml = window.DOMPurify.sanitize(window.marked.parse(s.body.trim()));
      bodyEl.innerHTML = titleHtml + bodyHtml;

      article.appendChild(dateEl);
      article.appendChild(bodyEl);
      listEl.appendChild(article);
    });
  }

  async function init() {
    try {
      const [md] = await Promise.all([
        fetch(MD_URL, { cache: "no-cache" }).then((r) => {
          if (!r.ok) throw new Error("http " + r.status);
          return r.text();
        }),
        loadScript(MARKED_URL),
        loadScript(PURIFY_URL),
      ]);
      window.marked.setOptions({ breaks: false, gfm: true });
      render(parseSections(md));
    } catch (err) {
      console.error("updates:", err);
      listEl.innerHTML = `<div class="updates-error">
        Could not load updates. <code>${escapeHtml(String(err.message || err))}</code>
      </div>`;
    }
  }

  init();
})();
