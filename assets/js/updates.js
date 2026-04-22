(function () {
  "use strict";

  const listEl = document.querySelector("[data-updates]");
  if (!listEl) return;

  const MD_URL = "content/updates.md";
  const MARKED_URL = "https://cdn.jsdelivr.net/npm/marked@12/marked.min.js";
  const PURIFY_URL = "https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js";

  // Each entry starts with a level-2 heading: ## YYYY-MM-DD — Title
  // Titles after the date are free-form; anything up to the next `##` is the body.
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

    // Most recent first
    out.sort((a, b) => (a.date < b.date ? 1 : -1));
    return out;
  }

  function formatDate(iso) {
    const d = new Date(iso + "T00:00:00Z");
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
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

      const titleHtml = s.title
        ? `<h3>${escapeHtml(s.title)}</h3>`
        : "";

      const bodyHtml = window.DOMPurify.sanitize(window.marked.parse(s.body.trim()));
      bodyEl.innerHTML = titleHtml + bodyHtml;

      article.appendChild(dateEl);
      article.appendChild(bodyEl);
      listEl.appendChild(article);
    });
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
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
      console.error("updates.js:", err);
      listEl.innerHTML = `<div class="updates-error">
        Could not load updates. <code>${escapeHtml(String(err.message || err))}</code>
      </div>`;
    }
  }

  init();
})();
