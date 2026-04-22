(function () {
  "use strict";

  const root = document.querySelector("[data-money-counter]");
  if (!root) return;

  const valueEl = root.querySelector("[data-counter-value]");
  const barEl = root.querySelector("[data-counter-bar]");
  const statusEl = root.querySelector("[data-counter-status]");
  const statusText = statusEl.querySelector(".counter-status-text");
  const eventsEl = root.querySelector("[data-counter-events]");

  const CAP = 500;
  const WARN_AT = 0.6;   // 60%
  const DANGER_AT = 0.85; // 85%
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Static presentation for reduced motion — show the gate-fire end state
  if (reduceMotion) {
    setValue(CAP);
    setState("blocked");
    statusText.textContent = "gate fired · authority exhausted";
    addEvent("GATE FIRED", "blocked");
    addEvent("monitored by runvault.ai", "muted");
    return;
  }

  const fmt = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  function setValue(v) {
    const safe = Math.max(0, v);
    valueEl.textContent = fmt.format(safe);
    const pct = Math.max(0, Math.min(100, (safe / CAP) * 100));
    barEl.style.width = pct + "%";
  }

  function setState(state) {
    ["warn", "danger", "blocked"].forEach((s) => {
      if (s === state) {
        valueEl.setAttribute("data-state", s);
        barEl.setAttribute("data-state", s);
        statusEl.setAttribute("data-state", s);
      }
    });
    if (!state) {
      valueEl.removeAttribute("data-state");
      barEl.removeAttribute("data-state");
      statusEl.removeAttribute("data-state");
    }
  }

  function addEvent(text, variant) {
    const el = document.createElement("span");
    el.className = "counter-event" + (variant ? " is-" + variant : "");
    el.textContent = text;
    eventsEl.appendChild(el);
    // Keep last 3
    while (eventsEl.children.length > 3) {
      eventsEl.removeChild(eventsEl.firstChild);
    }
  }

  // One "run": agent spends up to and past the cap, gate fires, pause, reset.
  let target = 0;
  let current = 0;
  let stage = null; // null | 'warn' | 'danger' | 'blocked'
  let raf = null;
  let running = false;

  const txSequence = [
    { delta: 12.40,  label: "llm · claude-opus · $12.40" },
    { delta: 7.10,   label: "llm · claude-opus · $7.10" },
    { delta: 29.99,  label: "purchase · amazon.com · $29.99" },
    { delta: 48.20,  label: "purchase · stripe · $48.20" },
    { delta: 22.00,  label: "llm · gpt-4 · $22.00" },
    { delta: 56.75,  label: "purchase · shopify · $56.75" },
    { delta: 73.30,  label: "llm · claude-opus · $73.30" },
    { delta: 64.10,  label: "purchase · uber · $64.10" },
    { delta: 88.00,  label: "purchase · airbnb · $88.00" },
    { delta: 95.20,  label: "purchase · delta · $95.20" },
    { delta: 120.00, label: "purchase · hotel · $120.00" }, // will push over
  ];

  function scheduleNextTx(i) {
    if (!running) return;
    if (i >= txSequence.length) {
      // Shouldn't happen — we'll block before the last
      fireGate("exhausted");
      return;
    }

    const tx = txSequence[i];
    const prospective = current + tx.delta;

    if (prospective > CAP) {
      // Gate fires BEFORE the charge
      fireGate(tx.label);
      return;
    }

    target = prospective;
    addEvent("+ " + tx.label,
      target / CAP >= DANGER_AT ? "danger" :
      target / CAP >= WARN_AT  ? "warn"   : null);

    // Animate to target, then schedule next
    animateTo(target, () => {
      updateStage();
      setTimeout(() => scheduleNextTx(i + 1), stage === "danger" ? 750 : 450);
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

  function fireGate(label) {
    stage = "blocked";
    setState("blocked");
    statusText.textContent = "gate fired · authority exhausted";
    addEvent("BLOCKED · " + label, "blocked");

    // Freeze briefly, then reset
    setTimeout(resetRun, 2600);
  }

  function resetRun() {
    if (!running) return;
    current = 0;
    target = 0;
    stage = null;
    setValue(0);
    setState(null);
    statusText.textContent = "monitoring";
    eventsEl.innerHTML = "";
    addEvent("new run · research-agent-01", null);
    setTimeout(() => scheduleNextTx(0), 700);
  }

  function start() {
    if (running) return;
    running = true;
    addEvent("new run · research-agent-01", null);
    setTimeout(() => scheduleNextTx(0), 500);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
  }

  // Only run when visible
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) start();
          else stop();
        });
      },
      { threshold: 0.25 }
    );
    io.observe(root);
  } else {
    start();
  }

  // Pause when tab hidden
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (root.getBoundingClientRect().top < window.innerHeight) start();
  });
})();
