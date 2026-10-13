const toggle = document.querySelector(".menu-toggle");
const nav = document.querySelector("#nav-principal");

function closeMenu() {
  nav.classList.remove("is-open");
  toggle.setAttribute("aria-expanded", "false");
}

toggle.addEventListener("click", () => {
  const open = nav.classList.toggle("is-open");
  toggle.setAttribute("aria-expanded", String(open));
});

nav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", closeMenu);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});

const form = document.querySelector("#form-pedido");
const status = document.querySelector("#form-status");
const preview = document.querySelector("#message-preview");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const nombre = String(data.get("nombre") || "").trim();
  const idea = String(data.get("idea") || "").trim();
  const cantidad = String(data.get("cantidad") || "").trim();
  const detalles = String(data.get("detalles") || "").trim();

  const lines = [
    nombre ? `Hola, soy ${nombre}.` : "Hola.",
    "Quiero encargar una impresión en La Comarca.",
    `Quiero imprimir: ${idea}.`,
    cantidad ? `Cantidad: ${cantidad}.` : "",
    detalles ? `Detalles: ${detalles}` : "",
  ].filter(Boolean);

  const message = lines.join("\n");
  preview.value = message;
  preview.hidden = false;

  try {
    await navigator.clipboard.writeText(message);
    status.textContent = "Mensaje copiado. Pegalo en el chat de Instagram.";
  } catch {
    status.textContent = "Copiá el mensaje de abajo y pegalo en Instagram.";
  }

  window.open("https://ig.me/m/lacomarca.impresiones", "_blank", "noopener");
});

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function createMotes(canvas, options) {
  if (!canvas || reduceMotion) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0;
  let height = 0;
  let motes = [];
  let running = false;
  let visible = true;

  function spawn(fromBottom) {
    return {
      x: Math.random() * Math.max(width, 1),
      y: fromBottom ? height + 12 : Math.random() * Math.max(height, 1),
      r: options.minR + Math.random() * (options.maxR - options.minR),
      speed: options.minS + Math.random() * (options.maxS - options.minS),
      drift: (Math.random() - 0.5) * 0.25,
      phase: Math.random() * Math.PI * 2,
      gold: Math.random(),
    };
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!motes.length) {
      motes = Array.from({ length: options.count }, () => spawn(false));
    }
  }

  function frame(now) {
    if (!running) return;
    ctx.clearRect(0, 0, width, height);
    for (const mote of motes) {
      mote.y -= mote.speed;
      mote.x += Math.sin(now / 800 + mote.phase) * 0.28 + mote.drift;
      if (mote.y < -16) {
        const next = spawn(true);
        mote.x = next.x;
        mote.y = next.y;
        mote.r = next.r;
        mote.speed = next.speed;
        mote.drift = next.drift;
        mote.phase = next.phase;
        mote.gold = next.gold;
      }
      if (mote.x < -20) mote.x = width + 10;
      if (mote.x > width + 20) mote.x = -10;

      const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now / 380 + mote.phase));
      const glow = mote.r * 5;
      const gradient = ctx.createRadialGradient(mote.x, mote.y, 0, mote.x, mote.y, glow);
      const ink = mote.gold > 0.4 ? "242, 198, 96" : "186, 214, 132";
      gradient.addColorStop(0, `rgba(255, 250, 226, ${0.95 * twinkle})`);
      gradient.addColorStop(0.4, `rgba(${ink}, ${0.42 * twinkle})`);
      gradient.addColorStop(1, `rgba(${ink}, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, glow, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
  }

  resize();
  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(canvas);
  } else {
    window.addEventListener("resize", resize);
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible && !document.hidden) start();
      else stop();
    }).observe(canvas);
  } else {
    start();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (visible) start();
  });
}

createMotes(document.querySelector("#luciernagas"), {
  count: 32,
  minR: 1.1,
  maxR: 2.4,
  minS: 0.18,
  maxS: 0.55,
});

createMotes(document.querySelector("#luciernagas-noche"), {
  count: 30,
  minR: 1.2,
  maxR: 2.8,
  minS: 0.12,
  maxS: 0.42,
});

function sowPolen(root, count) {
  if (!root || reduceMotion) return;
  const field = document.createElement("div");
  field.className = "polen";
  field.setAttribute("aria-hidden", "true");
  for (let index = 0; index < count; index += 1) {
    const speck = document.createElement("span");
    const size = 4 + Math.random() * 6;
    speck.style.left = `${4 + Math.random() * 92}%`;
    speck.style.animationDuration = `${11 + Math.random() * 18}s`;
    speck.style.animationDelay = `${-Math.random() * 20}s`;
    speck.style.width = `${size}px`;
    speck.style.height = `${size}px`;
    field.appendChild(speck);
  }
  root.appendChild(field);
}

document.querySelectorAll("#taller, .atlas, #piezas, #sendero, .anochecer").forEach((section) => {
  sowPolen(section, 16);
});

function paintFondo(root, colors) {
  if (!root || reduceMotion) return;
  const layer = document.createElement("div");
  layer.className = "fondo-vivo";
  layer.setAttribute("aria-hidden", "true");
  colors.forEach((color, index) => {
    const blob = document.createElement("span");
    blob.style.background = color;
    blob.style.left = `${8 + index * 26}%`;
    blob.style.top = `${12 + (index % 3) * 24}%`;
    blob.style.animationDuration = `${26 + index * 8}s`;
    blob.style.animationDelay = `${-index * 5}s`;
    layer.appendChild(blob);
  });
  root.prepend(layer);
}

paintFondo(document.querySelector(".atlas"), [
  "rgba(226, 179, 64, 0.34)",
  "rgba(120, 168, 78, 0.32)",
  "rgba(255, 236, 190, 0.4)",
]);
paintFondo(document.querySelector("#taller"), [
  "rgba(255, 196, 90, 0.4)",
  "rgba(47, 122, 60, 0.22)",
]);
paintFondo(document.querySelector("#piezas"), [
  "rgba(226, 112, 72, 0.24)",
  "rgba(110, 176, 214, 0.26)",
  "rgba(226, 179, 64, 0.3)",
]);
paintFondo(document.querySelector("#sendero"), [
  "rgba(184, 116, 42, 0.26)",
  "rgba(36, 122, 58, 0.2)",
  "rgba(255, 214, 140, 0.28)",
]);

const hero = document.querySelector(".hero");
const lantern = document.querySelector("#linterna");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
if (hero && lantern && finePointer && !reduceMotion) {
  hero.addEventListener("pointermove", (event) => {
    const rect = hero.getBoundingClientRect();
    lantern.style.opacity = "1";
    lantern.style.transform = `translate(${event.clientX - rect.left}px, ${event.clientY - rect.top}px)`;
  });
  hero.addEventListener("pointerleave", () => {
    lantern.style.opacity = "0";
  });
}

const fill = document.querySelector("#sendero-lleno");
const mote = document.querySelector("#sendero-mote");
const trail = document.querySelector("#camino-trazo");

function walk() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  const percent = `${progress * 100}%`;
  if (fill) fill.style.width = percent;
  if (mote) mote.style.left = percent;
  if (trail) trail.style.strokeDashoffset = String(1 - progress);
}

if (!reduceMotion) {
  walk();
  window.addEventListener("scroll", walk, { passive: true });
  window.addEventListener("resize", walk);
}
