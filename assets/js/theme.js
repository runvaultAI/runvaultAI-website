(function () {
  "use strict";

  const KEY = "runvault:theme";
  const root = document.documentElement;

  function apply(theme) {
    root.setAttribute("data-theme", theme);
  }

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

  // React to OS theme changes if user has not explicitly chosen
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  mq.addEventListener("change", (e) => {
    try {
      if (localStorage.getItem(KEY)) return;
    } catch (err) {}
    apply(e.matches ? "light" : "dark");
  });
})();
