(function () {
  "use strict";

  const svg = document.querySelector("svg.token-flow");
  if (!svg) return;

  const NS = "http://www.w3.org/2000/svg";
  const LINE_COUNT = 14;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function build() {
    const w = window.innerWidth;
    const h = Math.max(window.innerHeight, document.documentElement.scrollHeight);

    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.innerHTML = "";

    for (let i = 0; i < LINE_COUNT; i++) {
      const path = document.createElementNS(NS, "path");
      const d = makePath(w, h, i);
      path.setAttribute("d", d);

      const isAccent = i % 3 === 0;
      path.setAttribute("stroke", `var(--token-line${isAccent ? "" : "-faint"})`);
      path.setAttribute("stroke-width", isAccent ? "1" : "0.8");

      // Randomize dash + duration so streams feel independent
      const dashLen = 2 + (i % 3);
      const gap = 8 + ((i * 3) % 10);
      path.setAttribute("stroke-dasharray", `${dashLen} ${gap}`);

      if (!reduceMotion) {
        const dur = 6 + ((i * 1.3) % 8); // 6s – 14s
        path.style.animationDuration = dur + "s";
        path.style.animationDelay = `-${(i * 0.6) % 4}s`;
      }

      svg.appendChild(path);
    }
  }

  function makePath(w, h, i) {
    // Distribute start Y across height, gentle bezier curves across width
    const startY = (h / (LINE_COUNT - 1)) * i + (((i * 37) % 80) - 40);
    const endY = startY + (((i * 53) % 160) - 80);
    const cp1x = w * 0.28 + (((i * 19) % 80) - 40);
    const cp1y = startY + (((i * 23) % 120) - 60);
    const cp2x = w * 0.72 + (((i * 31) % 80) - 40);
    const cp2y = endY + (((i * 29) % 120) - 60);
    return `M -40 ${startY.toFixed(1)} C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${(w + 40).toFixed(1)} ${endY.toFixed(1)}`;
  }

  build();

  // Rebuild on significant resize (width change or doc height grew)
  let lastW = window.innerWidth;
  let lastH = document.documentElement.scrollHeight;
  let rebuildTimer = null;

  window.addEventListener("resize", () => {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      const w = window.innerWidth;
      const h = document.documentElement.scrollHeight;
      if (Math.abs(w - lastW) > 20 || Math.abs(h - lastH) > 200) {
        lastW = w;
        lastH = h;
        build();
      }
    }, 200);
  });

  // Re-measure once the page has fully loaded (images, fonts)
  window.addEventListener("load", () => {
    const h = document.documentElement.scrollHeight;
    if (Math.abs(h - lastH) > 200) {
      lastH = h;
      build();
    }
  });
})();
