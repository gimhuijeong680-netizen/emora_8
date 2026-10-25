const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const easeOut = (t) => 1 - Math.pow(1 - t, 4);

// ── Fit the 1920px canvas to the viewport ──
let zoom = 1;
function fit() {
  zoom = document.documentElement.clientWidth / 1920;
  document.documentElement.style.setProperty("--z", zoom);
}
fit();
addEventListener("resize", fit);

// ── Toast ──
const toast = $(".toast");
let toastTimer;
function showToast(text, color) {
  toast.replaceChildren();
  if (color) {
    const chip = document.createElement("i");
    chip.style.background = color;
    toast.append(chip);
  }
  toast.append(text);
  toast.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-on"), 1800);
}

// ── "Run while visible" helper for loops and one-shot triggers ──
function whenVisible(el, onEnter, onLeave, options = {}) {
  if (!el) return;
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) onEnter?.();
    else onLeave?.();
  }, { rootMargin: options.margin ?? "0px", threshold: 0 });
  io.observe(el);
}

// ── Autoplay for the promo prototypes ──
// Runs a timed script while `root` is on screen and loops it. Each script step is [delay after the
// previous step, fn]. A real tap pauses the demo for a while so it can still be explored by hand.
// Timers are always cleared before a (re)start, so loops never stack up.
function autoplay(root, script, { resumeAfter = 8000, margin = "0px 0px -15% 0px", onLeave } = {}) {
  let timers = [], visible = false, resume = 0, pausedUntil = 0;
  const stop = () => { timers.forEach(clearTimeout); timers = []; };
  const run = () => {
    stop();
    if (!visible) return;
    let t = 0;
    script().forEach(([dt, fn]) => { t += dt; timers.push(setTimeout(fn, t)); });
    timers.push(setTimeout(run, t));
  };
  // While a manual pause is pending, coming into view must not restart the demo early
  whenVisible(root, () => { visible = true; if (Date.now() >= pausedUntil) run(); },
    () => { visible = false; stop(); onLeave?.(); }, { margin });
  root.addEventListener("pointerdown", (e) => {
    if (!e.isTrusted) return;
    stop();
    clearTimeout(resume);
    pausedUntil = Date.now() + resumeAfter;
    resume = setTimeout(run, resumeAfter);
  }, true);
}
// A scripted tap: the pressed look first, then the control's own click handler on release
const tap = (el) => {
  el.classList.add("is-press");
  setTimeout(() => { el.classList.remove("is-press"); el.click(); }, 160);
};
const hold = () => {};

// ── Reveal system: delays, staggers, replayable observer ──
$$("[data-r][data-d]").forEach((el) => el.style.setProperty("--d", el.dataset.d));
$$("[data-stagger]").forEach((group) => {
  const step = Number(group.dataset.stagger);
  const base = Number(group.dataset.base || 0);
  $$("[data-r]", group).forEach((el, i) => el.style.setProperty("--d", base + i * step + Number(el.dataset.d || 0)));
});
$$('[data-r="lines"]').forEach((el) => $$(".ln > span", el).forEach((s, i) => s.style.setProperty("--li", i)));

// Main copy: wrap each word (never single jamo) so text and the gradient behind it fill in word by word
$$('[data-r="copy"]').forEach((el) => {
  const words = el.textContent.trim().split(/\s+/);
  el.setAttribute("aria-label", words.join(" "));
  el.replaceChildren(...words.flatMap((word, i) => {
    const w = document.createElement("span");
    w.className = "mc-w";
    w.setAttribute("aria-hidden", "true");
    w.style.setProperty("--w", i);
    const t = document.createElement("span");
    t.className = "mc-t";
    t.textContent = word;
    w.append(t);
    return i < words.length - 1 ? [w, " "] : [w];
  }));
  // One continuous gradient across the line: each word shows its slice of it
  const measure = () => {
    const ws = $$(".mc-w", el);
    el.style.setProperty("--lw", `${el.offsetWidth + 6}px`);
    ws.forEach((w) => w.style.setProperty("--x", `${w.offsetLeft}px`));
  };
  measure();
  document.fonts?.ready.then(measure);
});

// Enter when 10% inside the viewport; reset only once fully out of view, so the motion replays
// in either scroll direction without flickering at the edge.
const enterIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("in"); });
}, { rootMargin: "0px 0px -10% 0px", threshold: 0 });
const exitIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (!e.isIntersecting) e.target.classList.remove("in"); });
}, { threshold: 0 });
const observeReveal = (el) => { enterIO.observe(el); exitIO.observe(el); };
$$("[data-r]").forEach(observeReveal);

// ── Scroll: progress bar, scroll parallax, concept bands ──
const progress = $(".progress");
const depthEls = $$("[data-depth-scroll]").map((el) => ({ el, f: Number(el.dataset.depthScroll), y: 0 }));
const bands = $$("[data-band]").map((band) => ({ band, shifts: $$("[data-shift]", band) }));
let ticking = false;

function onScroll() {
  const vh = innerHeight;
  const max = document.documentElement.scrollHeight - vh;
  progress.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  if (reduceMotion) return;

  depthEls.forEach((d) => {
    const r = d.el.getBoundingClientRect();
    const center = r.top - d.y * zoom + r.height / 2;
    if (center < -vh || center > vh * 2) return;
    d.y = ((center - vh / 2) * d.f) / zoom;
    d.el.style.transform = `translate3d(0, ${d.y.toFixed(1)}px, 0)`;
  });

  bands.forEach(({ band, shifts }) => {
    const r = band.getBoundingClientRect();
    const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / vh));
    band.style.backgroundPosition = `${50 + p * 40}% 0`;
    shifts.forEach((s) => (s.style.transform = `translate3d(${(Number(s.dataset.shift) * p * 70).toFixed(1)}px, 0, 0)`));
  });
}
addEventListener("scroll", () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { onScroll(); ticking = false; });
}, { passive: true });
onScroll();

// ── 1. Hero: blobs lean toward the pointer ──
if (finePointer && !reduceMotion) {
  const hero = $(".hero");
  const blobs = $$(".hero__blob").map((el) => ({ el, depth: Number(el.dataset.depth), x: 0, y: 0 }));
  let tx = 0, ty = 0, raf = 0, heroVisible = true;
  const loop = () => {
    blobs.forEach((b) => {
      b.x += (tx * b.depth - b.x) * 0.06;
      b.y += (ty * b.depth - b.y) * 0.06;
      b.el.style.transform = `translate3d(${b.x.toFixed(2)}px, ${b.y.toFixed(2)}px, 0)`;
    });
    raf = heroVisible ? requestAnimationFrame(loop) : 0;
  };
  hero.addEventListener("pointermove", (e) => {
    tx = e.clientX / innerWidth - 0.5;
    ty = e.clientY / innerHeight - 0.5;
  });
  whenVisible(hero, () => { heroVisible = true; if (!raf) raf = requestAnimationFrame(loop); }, () => (heroVisible = false));
}

// ── 2. Overview motion: mixed-emotion pairs breathe through the gap ──
{
  const panel = $(".motion-panel");
  const a = $('[data-venn="a"]'), b = $('[data-venn="b"]'), en = $('[data-venn="en"]');
  const pairs = [["설렘", "불안", "EXCITEMENT + ANXIETY"], ["기쁨", "허전함", "JOY + EMPTINESS"], ["후련함", "아쉬움", "RELIEF + EMPTINESS"]];
  let i = 0, timer = 0;
  const swap = () => {
    panel.classList.add("venn-out");
    setTimeout(() => {
      i = (i + 1) % pairs.length;
      [a.textContent, b.textContent, en.textContent] = pairs[i];
      panel.classList.remove("venn-out");
      panel.classList.add("venn-pre");
      requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.remove("venn-pre")));
    }, 500);
  };
  whenVisible(panel, () => { if (!timer) timer = setInterval(swap, 3000); }, () => { clearInterval(timer); timer = 0; });
}

// ── 4. Watch: heart rate climbs, then the nudge arrives ──
{
  const bpm = $("[data-bpm]");
  let shown = false;
  whenVisible($(".watch-wrap"), () => {
    if (shown) return;
    shown = true;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 2600);
      bpm.textContent = Math.round(72 + 22 * easeOut(t));
      if (t < 1) requestAnimationFrame(step);
    };
    reduceMotion ? (bpm.textContent = 94) : requestAnimationFrame(step);
  });
}

// ── 5. Five dimensions carousel ──
{
  const card = $("[data-dims]");
  const item = $(".dims__item", card);
  const ko = $('[data-dim="ko"]', card), en = $('[data-dim="en"]', card), desc = $('[data-dim="desc"]', card);
  const dims = [
    ["부정 긴급성", "Negative Urgency", "강한 부정적 감정에 성급히 행동하는 경향"],
    ["긍정 긴급성", "Positive Urgency", "강한 긍정적 감정에 성급히 행동하는 경향"],
    ["계획성 부족", "Lack of Premeditation", "결과를 충분히 생각하지 않고 행동하는 경향"],
    ["인내심 부족", "Lack of Perseverance", "어렵거나 지루한 일을 끝까지 이어가기 힘든 경향"],
    ["감각 추구", "Sensation Seeking", "새롭고 강렬한 자극을 찾아 움직이는 경향"],
  ];
  const dotsWrap = $(".dims__dots", card);
  const dots = dims.map((d, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-label", `${d[0]} ${d[1]}`);
    btn.append(document.createElement("i"));
    btn.addEventListener("click", () => go(i));
    dotsWrap.append(btn);
    return btn;
  });
  let cur = 0, running = false;
  const mark = () => dots.forEach((d, i) => {
    d.classList.toggle("is-on", i === cur && running);
    d.classList.toggle("is-done", i < cur || (i === cur && !running));
    d.setAttribute("aria-selected", String(i === cur));
  });
  function go(i) {
    if (i === cur) return;
    cur = i;
    dots.forEach((d) => d.classList.remove("is-on"));
    item.classList.add("is-leave");
    setTimeout(() => {
      [ko.textContent, en.textContent, desc.textContent] = dims[cur];
      item.classList.remove("is-leave");
      item.classList.add("is-pre");
      requestAnimationFrame(() => requestAnimationFrame(() => { item.classList.remove("is-pre"); mark(); }));
    }, 320);
  }
  dotsWrap.addEventListener("animationend", () => go((cur + 1) % dims.length));
  card.addEventListener("pointerenter", () => card.classList.add("is-paused"));
  card.addEventListener("pointerleave", () => card.classList.remove("is-paused"));
  whenVisible(card, () => { running = !reduceMotion; mark(); }, () => { running = false; mark(); });
}

// ── 5b. Mesh: lines draw one by one, then behavior nodes glow ──
{
  const mesh = $("[data-mesh]");
  $$(".mesh__dot-l", mesh).forEach((el, i) => el.style.setProperty("--d", 200 + i * 60));
  $$('[data-r="wipe"]', mesh).forEach((el, i) => el.style.setProperty("--d", 500 + i * 110));
  $$(".mesh__dot-r", mesh).forEach((el, i) => el.style.setProperty("--d", 1500 + i * 90));
}

// ── 6. Interview: hovering a need lights the insight it became ──
{
  const pairs = $$("[data-pair]");
  const light = (i, on) => pairs.forEach((el) => el.dataset.pair === i && el.classList.toggle("is-lit", on));
  pairs.forEach((el) => {
    if (finePointer) {
      el.addEventListener("pointerenter", () => light(el.dataset.pair, true));
      el.addEventListener("pointerleave", () => light(el.dataset.pair, false));
    } else {
      el.addEventListener("click", () => {
        const on = !el.classList.contains("is-lit");
        pairs.forEach((p) => p.classList.remove("is-lit"));
        light(el.dataset.pair, on);
      });
    }
  });
}

// ── 8. Function flow: the page scroll walks through the steps; both panels stay pinned ──
{
  const section = $("[data-flow]");
  const pin = $("[data-flow-pin]", section);
  const panel = $("[data-wheel]");
  const visuals = $$(".flow__vis", section);
  const items = $$(".wheel__list li", panel);
  const buttons = items.map((li) => $("button", li));
  const n = items.length;
  let active = 0;
  const prevSlot = new Map();

  function layout() {
    items.forEach((li, i) => {
      const slot = (((i - active) % n) + n + 2) % n - 2;
      const prev = prevSlot.get(li);
      const wraps = prev !== undefined && Math.abs(slot - prev) > 2;
      if (wraps) li.classList.add("is-wrap");
      li.style.transform = `translateY(${slot * 117}px)`;
      if (wraps) requestAnimationFrame(() => requestAnimationFrame(() => li.classList.remove("is-wrap")));
      prevSlot.set(li, slot);
      buttons[i].classList.toggle("is-on", slot === 0);
      buttons[i].setAttribute("aria-selected", String(slot === 0));
    });
    visuals.forEach((v) => v.classList.toggle("is-on", Number(v.dataset.step) === active));
  }

  // Centre the pinned 928px panels in the viewport (canvas px, i.e. before zoom)
  const PANEL = 928;
  let pinTop = 76;
  const placePin = () => {
    pinTop = Math.round(Math.max(0, Math.min(160, (innerHeight / zoom - PANEL) / 2)));
    pin.style.setProperty("--pin-top", `${pinTop}px`);
  };
  // Progress 0→1 across the track's free travel; each step owns an equal slice
  const track = pin.parentElement;
  const progress = () => {
    const r = track.getBoundingClientRect();
    const travel = (r.height - PANEL * zoom);
    return travel > 0 ? Math.max(0, Math.min(1, (pinTop * zoom - r.top) / travel)) : 0;
  };
  const sync = () => {
    const next = Math.min(n - 1, Math.round(progress() * (n - 1)));
    if (next !== active) { active = next; layout(); }
  };
  buttons.forEach((b, i) => b.addEventListener("click", () => {
    const r = track.getBoundingClientRect();
    const travel = r.height - PANEL * zoom;
    const y = scrollY + r.top - pinTop * zoom + (travel * i) / (n - 1);
    scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" });
  }));
  placePin();
  layout();
  sync();
  addEventListener("resize", () => { placePin(); sync(); });
  addEventListener("scroll", () => requestAnimationFrame(sync), { passive: true });
}

// ── 9. Video slot ──
$("[data-video]").addEventListener("click", () => showToast("영상은 곧 공개될 예정이에요"));

// ── 10. Brand color rows: hover to read, click to copy ──
{
  const wrap = $("[data-swatches]");
  const green = ["EAFFF0", "E0FFE9", "BFFFD1", "8CFBAC", "53F882", "2DEB64", "24D457"];
  const teal = ["E6FBF9", "DAF9F7", "B3F2EE", "40E6DB", "2DC0B6", "07AA9F", "07A095"];
  const heights = [84, 83, 83, 83, 83, 83, 83];
  const isDark = (hex) => {
    const [r, g, b] = [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.55;
  };
  const make = (hex, left, top, h, i, side) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `swatch-row ${isDark(hex) ? "is-dark" : "is-light"}`;
    row.style.cssText = `left:${left}px;top:${top}px;height:${h}px;background:#${hex};${side === "right" ? "justify-content:flex-end;" : ""}`;
    // Rows settle into place top → bottom; the paired row on the right follows a beat later
    row.dataset.r = "settle";
    row.style.setProperty("--d", i * 110 + (side === "right" ? 50 : 0));
    row.setAttribute("aria-label", `#${hex} 복사`);
    const label = document.createElement("span");
    label.textContent = `#${hex}`;
    row.append(label);
    row.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(`#${hex}`); } catch {}
      row.classList.add("is-copied");
      setTimeout(() => row.classList.remove("is-copied"), 1200);
      showToast(`#${hex} 복사됨`, `#${hex}`);
    });
    wrap.append(row);
    observeReveal(row);
  };
  let top = 779;
  heights.forEach((h, i) => {
    make(green[i], 0, top, h, i, "left");
    make(teal[i], 960, top, h, i, "right");
    top += h;
  });
}

// ── 13. Emotion wheel + custom color picker ──
{
  const wheel = $("[data-emo-wheel]");
  const emos = $$(".emo");
  const glow = $("[data-glow]");
  const cx = 1421, cy = 456;
  let visible = false, hovering = false, auto = -1, timer = 0, spreadTimer = 0;

  emos.forEach((emo, i) => {
    const left = parseFloat(emo.style.left), top = parseFloat(emo.style.top);
    const dx = cx - (left + 30), dy = cy - (top + 30);
    // Gathered: pulled to the centre, each kept a few px out along its own direction so they overlap as one cluster
    const len = Math.hypot(dx, dy) || 1;
    emo.dataset.from = `translate(${(dx + (-dx / len) * 12).toFixed(1)}px, ${(dy + (-dy / len) * 12).toFixed(1)}px) scale(0.8)`;
    emo.style.setProperty("--c", emo.dataset.c);
    emo.style.setProperty("--d", i * 60);
    emo.tabIndex = 0;
    emo.setAttribute("role", "button");
    emo.setAttribute("aria-label", `${$("b", emo).textContent} ${$(".emo__lbl span", emo).textContent}`);
  });
  const gather = () => {
    wheel.classList.add("is-instant", "is-gathered");
    emos.forEach((e) => { e.style.transform = e.dataset.from; e.style.opacity = "0"; });
    void wheel.offsetWidth;
    wheel.classList.remove("is-instant");
    emos.forEach((e) => (e.style.opacity = ""));   // cluster fades in where it is
  };
  const spread = () => {
    wheel.classList.remove("is-gathered");
    emos.forEach((e) => (e.style.transform = ""));
  };
  if (!reduceMotion) gather();

  const focus = (emo) => {
    emos.forEach((e) => e.classList.toggle("is-on", e === emo));
    glow.classList.toggle("is-on", Boolean(emo));
    if (emo) glow.style.backgroundColor = emo.dataset.c;
  };
  emos.forEach((emo) => {
    emo.addEventListener("pointerenter", () => { hovering = true; focus(emo); });
    emo.addEventListener("pointerleave", () => { hovering = false; focus(null); });
    emo.addEventListener("focus", () => focus(emo));
    emo.addEventListener("blur", () => focus(null));
    emo.addEventListener("click", () => focus(emo));
  });
  const cycle = () => { if (!hovering && visible) { auto = (auto + 1) % emos.length; focus(emos[auto]); } };

  // Each time the wheel comes into view: cluster → hold → open out; highlights start once it has settled
  whenVisible(emos[0], () => {
    visible = true;
    if (reduceMotion) return;
    spreadTimer = setTimeout(() => {
      spread();
      spreadTimer = setTimeout(() => { if (!timer) timer = setInterval(cycle, 1500); }, 1700);
    }, 700);
  }, () => {
    visible = false;
    clearTimeout(spreadTimer); clearInterval(timer); timer = 0; auto = -1; focus(null);
    if (!reduceMotion) gather();
  }, { margin: "0px 0px -15% 0px" });

  // Custom color chips: a drawn check marks the selected chip
  $$(".sw").forEach((sw) => {
    const mark = document.createElement("span");
    mark.className = "sw__check";
    mark.innerHTML = '<svg viewBox="0 0 26 26" aria-hidden="true"><path pathLength="1" d="M7 13.4l4.1 4 7.9-8.2" /></svg>';
    sw.append(mark);
  });

  // Two layers crossfade so one picked color dissolves into the next
  const tints = $$("[data-tint]");
  let front = 0;
  const swatches = $$(".sw");
  const pick = (sw) => {
    swatches.forEach((s) => s.setAttribute("aria-pressed", String(s === sw)));
    const c = sw.dataset.c;
    const next = tints[1 - front], prev = tints[front];
    next.style.backgroundImage = `linear-gradient(180deg, color-mix(in srgb, ${c} 55%, #fff), color-mix(in srgb, ${c} 18%, #fff))`;
    next.style.opacity = c === "#FFFFFF" ? "0" : "1";
    prev.style.opacity = "0";
    front = 1 - front;
  };
  swatches.forEach((sw) => sw.addEventListener("click", () => pick(sw)));
  // Demo: 보라 → 주황 → 노랑 → back to the designed 하늘
  const byName = (n) => swatches.find((s) => s.getAttribute("aria-label") === n);
  autoplay($("[data-picker]"), () => ["보라", "주황", "노랑", "하늘"].map((n, i) => [i ? 2200 : 1600, () => tap(byName(n))]).concat([[2200, hold]]));
  $("[data-save]").addEventListener("click", () => {
    const sel = swatches.find((s) => s.getAttribute("aria-pressed") === "true");
    showToast("나의 감정 색상이 저장됐어요", sel?.dataset.c);
  });
}

// ── 14. Step 2 prototypes ──
{
  // Sensing: one answer at a time
  const choice = $("[data-choice]");
  const opts = $$(".sense-btn", choice);
  opts.forEach((b) => b.addEventListener("click", () => opts.forEach((o) => o.setAttribute("aria-pressed", String(o === b)))));
  const clearChoice = () => opts.forEach((o) => o.setAttribute("aria-pressed", "false"));
  // Demo: 맞아요 → (clear) → 다른 감정 느껴요 → (clear) …
  autoplay(choice, () => [[900, () => tap(opts[0])], [2600, clearChoice], [900, () => tap(opts[1])], [2600, clearChoice], [500, hold]]);

  // Intensity: boxes up to the chosen level fill in, the chip and counter follow
  const swap = (el, text) => {
    if (el.textContent === text) return;
    el.textContent = text;
    el.classList.add("is-swap");
    void el.offsetWidth;
    el.classList.remove("is-swap");
  };
  const intensity = $$("[data-intensity]").map((lv) => {
    const boxes = $$(".lv__box", lv);
    const chip = $("[data-lv-chip]", lv), count = $("[data-lv-count]", lv);
    let level = 0;
    const setLevel = (n, animate = true) => {
      const prev = level;
      level = n;
      boxes.forEach((b, i) => {
        const on = i < n;
        // Fill upward one box after another; when lowering, drain from the top down
        const fd = !animate ? 0 : on ? Math.max(0, i - prev) * 70 : Math.max(0, prev - 1 - i) * 70;
        b.style.setProperty("--fd", `${fd}ms`);
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-checked", String(i === n - 1));
      });
      // Nothing chosen yet: hide the result chip, counter reads 0
      lv.classList.toggle("is-empty", n === 0);
      if (n) swap(chip, `${lv.dataset.emotion} ${n}`);
      swap(count, String(n));
    };
    boxes.forEach((b, i) => b.addEventListener("click", () => setLevel(i + 1)));
    setLevel(boxes.findIndex((b) => b.getAttribute("aria-checked") === "true") + 1, false);
    return { lv, boxes, setLevel };
  });

  // Big intensity panel demo: starts and ends on the designed level 2 (3 → 4 → 1 → 2)
  const big = intensity.find((x) => !x.lv.classList.contains("lv--sm"));
  autoplay(big.lv.closest(".proto"), () => [[1400, () => tap(big.boxes[2])], [700, () => tap(big.boxes[3])], [2200, () => tap(big.boxes[0])], [900, () => tap(big.boxes[1])], [2600, hold]]);

  // Check rows (emotions / situation): independent toggles; the tick redraws when switched on
  const setRow = (btn, on, draw = true) => {
    btn.setAttribute("aria-pressed", String(on));
    btn.classList.remove("is-drawn");
    if (on && draw) { void btn.offsetWidth; btn.classList.add("is-drawn"); }
  };
  $$(".sit").forEach((btn) => btn.addEventListener("click", () => setRow(btn, btn.getAttribute("aria-pressed") !== "true")));

  // Result phone: home → emotions (슬픔, 두려움, 화) → intensity (슬픔 2) → situation (대인관계) → back home
  const phone = $("[data-phone]");
  const screens = $$(".phone__ui", phone);
  const [, emoScreen, lvScreen, sitScreen] = screens;
  const emoRows = $$(".sit", emoScreen), sitRows = $$(".sit", sitScreen);
  const small = intensity.find((x) => x.lv.classList.contains("lv--sm"));
  const show = (i) => screens.forEach((s, j) => { s.classList.toggle("is-on", j === i); s.classList.toggle("is-past", j < i); });
  // Clear the later screens only while they are hidden behind the home screen
  const resetFlow = () => {
    [...emoRows, ...sitRows].forEach((r) => setRow(r, false, false));
    small.setLevel(0, false);
  };
  autoplay(phone, () => [
    [0, () => show(0)], [600, resetFlow],
    [1300, () => show(1)], [900, () => tap(emoRows[1])], [700, () => tap(emoRows[2])], [700, () => tap(emoRows[6])],
    [1400, () => show(2)], [900, () => tap(small.boxes[0])], [600, () => tap(small.boxes[1])],
    [1500, () => show(3)], [900, () => tap(sitRows[0])],
    [2800, hold],
  ]);
}

// ── 12. Step 1 (ref. 동영상1): after the cards deal in, the stack shuffles every ~3.6s ──
if (!reduceMotion) {
  const s1 = $("[data-shuffle]");
  let hue = 0;
  autoplay(s1, () => [
    [2400, () => s1.classList.add("is-shuffle")],
    [450, () => { hue = (hue + 1) % 3; s1.dataset.hue = hue; }],   // new palette arrives with the swap
    [450, () => s1.classList.remove("is-shuffle")],
    [300, hold],
  ], { margin: "-20% 0px -20% 0px", onLeave: () => { hue = 0; s1.dataset.hue = 0; s1.classList.remove("is-shuffle"); } });
}

// ── 15. Care: status bars rise to the pre-care level, then ease to their values ──
{
  const wrap = $("[data-care-bars]");
  const bars = $$(".cbar", wrap);
  let timers = [];
  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  const set = (bar, key) => bar.style.setProperty("--h", bar.style.getPropertyValue(key));
  if (!reduceMotion) whenVisible(wrap.parentElement, () => {
    clear();
    wrap.classList.add("is-instant");
    bars.forEach((b) => b.style.setProperty("--h", 0));
    void wrap.offsetWidth;
    wrap.classList.remove("is-instant");
    bars.forEach((b, i) => {
      timers.push(setTimeout(() => set(b, "--peak"), 500 + i * 160));
      timers.push(setTimeout(() => set(b, "--to"), 2000 + i * 160));
    });
  }, () => { clear(); bars.forEach((b) => b.style.removeProperty("--h")); }, { margin: "0px 0px -20% 0px" });
}

// ── 15. Care: step counter, 30s timer ──
$$("[data-count]").forEach((el) => {
  const target = Number(el.dataset.count);
  let done = false;
  whenVisible(el, () => {
    if (done) return;
    done = true;
    if (reduceMotion) { el.textContent = target; return; }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 1600);
      el.textContent = Math.round(target * easeOut(t));
      if (t < 1) requestAnimationFrame(step);
    };
    setTimeout(() => requestAnimationFrame(step), 500);
  });
});

{
  const btn = $("[data-timer]");
  const ring = $(".timer__ring", btn);
  const time = $("[data-time]", btn);
  const sub = $("[data-timer-sub]", btn);
  const TOTAL = 30000, DRAW = 1600;
  let elapsed = 0, last = 0, raf = 0, paused = false, visible = false, doneAt = 0;
  // The gauge starts empty and is drawn once around the ring (DRAW ms) whenever the timer comes into
  // view or starts a new round; after that it tracks the remaining time as before.
  let draw = reduceMotion ? 1 : 0, drawStart = 0;

  const render = () => {
    const left = Math.max(0, TOTAL - elapsed);
    const secs = Math.ceil(left / 1000);
    time.textContent = `00:${String(secs).padStart(2, "0")}`;
    ring.style.setProperty("--p", `${((left / TOTAL) * 360 * draw).toFixed(2)}deg`);
  };
  const frame = (now) => {
    if (last) elapsed += now - last;
    last = now;
    if (drawStart) {
      const t = Math.min(1, (now - drawStart) / DRAW);
      draw = 1 - Math.pow(1 - t, 3);
      if (t === 1) drawStart = 0;
    }
    if (elapsed >= TOTAL) {
      elapsed = TOTAL;
      if (!doneAt) { doneAt = now; sub.textContent = "잘했어요"; }
      if (now - doneAt > 1800) { elapsed = 0; doneAt = 0; sub.textContent = "남은 시간"; draw = 0; drawStart = now; }
    }
    render();
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (raf || paused || !visible) return; last = 0; btn.classList.add("is-running"); raf = requestAnimationFrame(frame); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; btn.classList.remove("is-running"); };
  btn.addEventListener("click", () => {
    paused = !paused;
    sub.textContent = paused ? "일시정지" : "남은 시간";
    paused ? stop() : start();
  });
  render();
  if (!reduceMotion) whenVisible(btn, () => {
    visible = true;
    if (!paused) drawStart = performance.now();
    start();
  }, () => { visible = false; stop(); if (!paused) { draw = 0; render(); } });   // empty again while off screen
}

// ── 16. Archive: weekly bars, day highlight, typed report ──
{
  const chart = $("[data-chart]");
  const bars = $$(".bar", chart), days = $$(".day", chart);
  // Bars rise one after another (marks follow their bar) and replay whenever the chart re-enters
  bars.forEach((bar, i) => bar.style.setProperty("--d", i * 110));
  $$(".mark", chart).forEach((m) => m.style.setProperty("--d", (Number(m.style.getPropertyValue("--d")) / 80) * 110));
  whenVisible(days[0], () => chart.classList.add("in"), () => chart.classList.remove("in"), { margin: "0px 0px -10% 0px" });
  bars.forEach((bar, i) => {
    bar.addEventListener("pointerenter", () => days[i].classList.add("is-on"));
    bar.addEventListener("pointerleave", () => days[i].classList.remove("is-on"));
  });

  const report = $("[data-type]");
  const full = report.dataset.type;
  let typed = false;
  whenVisible(report, () => {
    if (typed) return;
    typed = true;
    if (reduceMotion) { report.textContent = full; return; }
    const caret = document.createElement("span");
    caret.className = "caret";
    const text = document.createTextNode("");
    report.append(text, caret);
    let n = 0;
    setTimeout(function type() {
      text.data = full.slice(0, ++n);
      if (n < full.length) setTimeout(type, full[n - 1] === "\n" ? 260 : 26);
      else setTimeout(() => caret.remove(), 1600);
    }, 900);
  }, null, { margin: "0px 0px -15% 0px" });
}

// ── 16b. Archive notification: slides up, the emotion turns to 화, slides away, repeats ──
{
  const ui = $("[data-pill]");
  autoplay(ui.parentElement, () => [
    [1000, () => ui.classList.add("is-up")],
    [1600, () => ui.classList.add("is-changed")],
    [3600, () => ui.classList.remove("is-up")],
    [700, () => ui.classList.remove("is-changed")],   // reset while hidden
    [600, hold],
  ], { onLeave: () => ui.classList.remove("is-up", "is-changed") });
}

// ── 16c. 10월 3주 (ref. 동영상3): list → 주간 → 일간 → 주간 … while on screen, no pointer needed ──
{
  const week = $("[data-week]");
  const tabs = $$(".week__toggle span", week);
  let timer = 0, step = 0;
  const show = (view) => {
    week.dataset.view = view;
    tabs[0].setAttribute("aria-selected", String(view !== "week"));
    tabs[1].setAttribute("aria-selected", String(view === "week"));
  };
  whenVisible(week.parentElement, () => {
    clearTimeout(timer);
    step = 0;
    show("list");
    const next = () => { show(step++ % 2 ? "day" : "week"); timer = setTimeout(next, 3400); };
    timer = setTimeout(next, 1800);
  }, () => { clearTimeout(timer); show("list"); }, { margin: "0px 0px -15% 0px" });
}

// ── 17. Share lanes loop seamlessly ──
$$("[data-lane]").forEach((track) => {
  [...track.children].forEach((child) => {
    const copy = child.cloneNode(true);
    copy.setAttribute("aria-hidden", "true");
    $$("img", copy).forEach((img) => (img.alt = ""));
    track.append(copy);
  });
});

// ── 18. Back to top ──
$("[data-top]").addEventListener("click", () => scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }));
