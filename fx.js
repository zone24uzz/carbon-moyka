// Carbon — vizual effektlar. Hammasi transform/opacity orqali, harakatni kamaytirish rejimida o'chadi.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(pointer: fine)").matches;
  const raf = (fn) => { let q = false; return (...a) => { if (q) return; q = true; requestAnimationFrame(() => { q = false; fn(...a); }); }; };

  /* 1. Preloader → sahifa ochiladi */
  const loaded = () => document.body.classList.add("is-loaded");
  if (reduce) loaded();
  else {
    window.addEventListener("load", () => setTimeout(loaded, 450));
    setTimeout(loaded, 2200); // zaxira
  }

  /* 2. Sarlavhalarni so'zlarga bo'lish (so'zma-so'z chiqadi) */
  function splitWords(el) {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((ch) => {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(" "); return; }
            const w = document.createElement("span");
            w.className = "wd";
            const inner = document.createElement("span");
            inner.textContent = part;
            inner.style.setProperty("--wi", i++);
            w.append(inner);
            frag.append(w);
          });
          ch.replaceWith(frag);
        } else if (ch.nodeType === 1 && ch.tagName !== "BR") walk(ch);
      });
    };
    walk(el);
    el.classList.add("words");
  }
  document.querySelectorAll(".title").forEach(splitWords);
  const tio = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("is-in"); tio.unobserve(e.target); }
  }), { threshold: 0.2 });
  document.querySelectorAll(".title.words").forEach((t) => tio.observe(t));

  /* 3. Sovun pufakchalari (hero canvas) */
  const cv = document.getElementById("bubbles");
  if (cv && !reduce) {
    const ctx = cv.getContext("2d");
    let W, H, dpr, bubbles = [], running = true;
    const size = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const make = (initial) => ({
      x: Math.random() * W,
      y: initial ? Math.random() * H : H + 40,
      r: 4 + Math.pow(Math.random(), 2) * 26,
      v: 0.25 + Math.random() * 0.6,
      ph: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.5 ? 0 : 200,
    });
    size();
    const count = W < 700 ? 16 : 30;
    bubbles = Array.from({ length: count }, () => make(true));
    window.addEventListener("resize", raf(size));
    let mx = -999, my = -999;
    cv.parentElement.addEventListener("pointermove", (e) => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
    const draw = (t) => {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      for (const b of bubbles) {
        b.y -= b.v * (1 + b.r / 40);
        b.x += Math.sin(t / 1400 + b.ph) * 0.35;
        // kursordan qochadi
        const dx = b.x - mx, dy = b.y - my, d = Math.hypot(dx, dy);
        if (d < 110) { b.x += (dx / d) * 1.6; b.y += (dy / d) * 1.2; }
        if (b.y < -40) Object.assign(b, make(false));
        const g = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.1, b.x, b.y, b.r);
        g.addColorStop(0, "rgba(255,255,255,0.55)");
        g.addColorStop(0.7, "rgba(255,255,255,0.08)");
        g.addColorStop(1, b.hue ? "rgba(36,72,255,0.22)" : "rgba(160,200,40,0.28)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(13,16,21,0.14)"; ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.35, Math.PI * 1.1, Math.PI * 1.6);
        ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 1.4; ctx.stroke();
      }
      requestAnimationFrame(draw);
    };
    new IntersectionObserver(([e]) => { const was = running; running = e.isIntersecting && !document.hidden; if (running && !was) requestAnimationFrame(draw); }).observe(cv);
    document.addEventListener("visibilitychange", () => { const was = running; running = !document.hidden; if (running && !was) requestAnimationFrame(draw); });
    requestAnimationFrame(draw);
  }

  if (reduce) return;
  document.documentElement.classList.add("fx-on");

  /* 4. Hero: sichqonchaga ergashadigan nur */
  const hero = document.querySelector(".hero");
  if (hero && fine) {
    hero.addEventListener("pointermove", raf((e) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty("--mx", `${e.clientX - r.left}px`);
      hero.style.setProperty("--my", `${e.clientY - r.top}px`);
      hero.classList.add("is-lit");
    }));
    hero.addEventListener("pointerleave", () => hero.classList.remove("is-lit"));
  }

  /* 5. Kartalar: chegara nuri + 3D qiyalik */
  if (fine) {
    const spot = ".pack, .price-row, .num, .live, .quote, .ticket-wrap, .chart-card, .receipt";
    document.addEventListener("pointermove", raf((e) => {
      const el = e.target.closest?.(spot);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      el.style.setProperty("--x", `${x}px`);
      el.style.setProperty("--y", `${y}px`);
      if (el.matches(".pack")) {
        const rx = ((y / r.height) - 0.5) * -6, ry = ((x / r.width) - 0.5) * 6;
        el.style.setProperty("--rx", `${rx}deg`);
        el.style.setProperty("--ry", `${ry}deg`);
        el.classList.add("is-tilt");
      }
    }));
    document.addEventListener("pointerout", (e) => {
      const el = e.target.closest?.(".is-tilt");
      if (el && !el.contains(e.relatedTarget)) { el.classList.remove("is-tilt"); el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); }
    });
  }

  /* 6. Magnit tugmalar */
  if (fine) {
    document.querySelectorAll(".btn:not(.btn--full)").forEach((b) => {
      b.addEventListener("pointermove", (e) => {
        const r = b.getBoundingClientRect();
        b.style.setProperty("--tx", `${(e.clientX - r.left - r.width / 2) * 0.22}px`);
        b.style.setProperty("--ty", `${(e.clientY - r.top - r.height / 2) * 0.3}px`);
        b.classList.add("is-mag");
      });
      b.addEventListener("pointerleave", () => { b.style.setProperty("--tx", "0px"); b.style.setProperty("--ty", "0px"); b.classList.remove("is-mag"); });
    });
  }

  /* 7. Maxsus kursor */
  const cur = document.querySelector(".cursor");
  if (cur && fine) {
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    document.addEventListener("pointermove", (e) => {
      x = e.clientX; y = e.clientY;
      cur.classList.add("is-on");
      cur.classList.toggle("is-hover", !!e.target.closest?.("a, button, label, input, select, summary, .ch-hit"));
    });
    document.addEventListener("pointerleave", () => cur.classList.remove("is-on"));
    const loop = () => {
      cx += (x - cx) * 0.2; cy += (y - cy) * 0.2;
      cur.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      requestAnimationFrame(loop);
    };
    loop();
  }

  /* 8. Diagramma ko'ringanda ustunlar o'sib chiqadi */
  document.querySelectorAll(".chart-box").forEach((box) => {
    new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting) return;
      box.classList.add("play");
      setTimeout(() => box.classList.add("played"), 1800);
      io.disconnect();
    }, { threshold: 0.3 }).observe(box);
  });

  /* 9. Bron qilinganda pufakchalar "portlashi" */
  window.fxBurst = (el) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    for (let i = 0; i < 18; i++) {
      const p = document.createElement("span");
      p.className = "burst";
      const a = (i / 18) * Math.PI * 2, d = 80 + Math.random() * 90, s = 6 + Math.random() * 16;
      p.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + 60}px;width:${s}px;height:${s}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 40}px`;
      document.body.append(p);
      setTimeout(() => p.remove(), 1200);
    }
  };
})();
