// ==========================================================================
// Cape Town Christian Tabernacle - shared site behavior
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initLogo();
  initTicker();
  initSermons();
  initAnnouncements();
  initEvents();
  initLeadership();
  initContactForm();
  initHomeTeasers();
  initGallery();
});

/* ---------------- Mobile nav ---------------- */
function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  nav.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => nav.classList.remove("open"))
  );
}

/* ---------------- Logo auto-fill ----------------
   Point every .brand-mark img at assets/logo.png. If the file hasn't been
   uploaded yet (404), fall back to a text glyph so the layout never breaks.
   To put your logo live: just add a file named "logo.png" inside /assets
   and push it to your repo - no code changes needed. */
function initLogo() {
  document.querySelectorAll(".brand-mark").forEach((mark) => {
    const img = mark.querySelector("img");
    if (!img) return;
    img.addEventListener("error", () => {
      img.remove();
      mark.classList.add("logo-fallback");
      const fallback = document.createElement("span");
      fallback.className = "fallback-glyph";
      fallback.textContent = "CT";
      mark.appendChild(fallback);
    });
  });
}

/* ---------------- Preacher of the week ticker ---------------- */
async function initTicker() {
  const track = document.querySelector(".ticker-track");
  if (!track) return;

  function showTicker(labelHtml) {
    const html = `<span>${labelHtml}</span>`;
    track.innerHTML = html + html; // duplicated so the marquee loops seamlessly
  }

  let preacher = null;
  try {
    const res = await fetch("data/announcements.json", { cache: "no-store" });
    const data = await res.json();
    preacher = data.preacherOfTheWeek;
  } catch (e) {
    return; // leave the default markup already in the HTML
  }

  // Manually set - always wins, no auto-pull needed.
  if (preacher && preacher.name && preacher.name.trim()) {
    showTicker(
      `<span class="ticker-eyebrow">Preacher of the week</span> <b>${escapeHtml(
        preacher.name
      )}</b> - ${escapeHtml(preacher.topic || "")}${
        preacher.date ? " · " + escapeHtml(preacher.date) : ""
      }`
    );
    return;
  }

  // preacherOfTheWeek.name left blank - auto-pull the latest YouTube upload.
  try {
    const vidRes = await fetch("/latest-video", { cache: "no-store" });
    const vid = await vidRes.json();
    if (vid && vid.title) {
      const dateStr = vid.published ? formatDate(vid.published) : "";
      showTicker(
        `<span class="ticker-eyebrow">Latest message</span> <b>${escapeHtml(
          vid.title
        )}</b>${dateStr ? " · " + escapeHtml(dateStr) : ""}`
      );
    }
  } catch (e) {
    /* leave the default markup already in the HTML */
  }
}

/* ---------------- Sermon library (sermons.html) ---------------- */
async function initSermons() {
  const list = document.querySelector("#sermon-list");
  if (!list) return;

  const searchInput = document.querySelector("#sermon-search");
  const preacherSelect = document.querySelector("#sermon-preacher-filter");
  const seriesSelect = document.querySelector("#sermon-series-filter");
  const viewToggle = document.querySelector("#sermon-view-toggle");
  let view = "series"; // default: grouped by series

  let sermons = [];
  try {
    const res = await fetch("data/sermons.json", { cache: "no-store" });
    const data = await res.json();
    sermons = data.sermons || [];
  } catch (e) {
    list.innerHTML = `<div class="state-msg">Couldn't load sermons right now. Check data/sermons.json.</div>`;
    return;
  }

  sermons.sort((a, b) => new Date(b.date) - new Date(a.date));

  const preachers = [...new Set(sermons.map((s) => s.preacher))].sort();
  if (preacherSelect) {
    preachers.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      preacherSelect.appendChild(opt);
    });
  }

  const seriesNames = [...new Set(sermons.map((s) => s.series).filter(Boolean))].sort();
  if (seriesSelect) {
    seriesNames.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      seriesSelect.appendChild(opt);
    });
  }

  function cardHtml(s) {
    return `
      <article class="arch-card">
        ${s.series ? `<span class="tag">${escapeHtml(s.series)}</span>` : ""}
        <h3>${escapeHtml(s.title)}</h3>
        <div class="meta">${escapeHtml(s.preacher)} · ${formatDate(s.date)}</div>
        <div class="audio-row">
          <audio controls preload="none" src="${escapeAttr(s.audioUrl)}"></audio>
        </div>
      </article>`;
  }

  function render() {
    const q = (searchInput?.value || "").toLowerCase();
    const preacherFilter = preacherSelect?.value || "";
    const seriesFilter = seriesSelect?.value || "";
    const filtered = sermons.filter((s) => {
      const matchesQ =
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.preacher.toLowerCase().includes(q) ||
        (s.series || "").toLowerCase().includes(q);
      const matchesPreacher = !preacherFilter || s.preacher === preacherFilter;
      const matchesSeries = !seriesFilter || s.series === seriesFilter;
      return matchesQ && matchesPreacher && matchesSeries;
    });

    if (!filtered.length) {
      list.innerHTML = `<div class="state-msg">No sermons match your search yet.</div>`;
      return;
    }

    if (view === "date") {
      list.innerHTML = `<div class="arch-grid">${filtered.map(cardHtml).join("")}</div>`;
      return;
    }

    // group by series, ordered by each group's most recent sermon date
    const groups = new Map();
    filtered.forEach((s) => {
      const key = s.series || "Other sermons";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    });
    const orderedGroups = [...groups.entries()].sort(
      (a, b) => new Date(b[1][0].date) - new Date(a[1][0].date)
    );

    list.innerHTML = orderedGroups
      .map(
        ([series, items]) => `
      <div class="sermon-group">
        <h3 class="sermon-group-title">${escapeHtml(series)} <span class="count">${items.length}</span></h3>
        <div class="arch-grid">${items.map(cardHtml).join("")}</div>
      </div>`
      )
      .join("");
  }

  searchInput?.addEventListener("input", render);
  preacherSelect?.addEventListener("change", render);
  seriesSelect?.addEventListener("change", render);
  viewToggle?.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      viewToggle.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      view = btn.dataset.view;
      render();
    });
  });
  render();
}

/* ---------------- Announcements (announcements.html) ---------------- */
async function initAnnouncements() {
  const list = document.querySelector("#announcement-list");
  if (!list) return;

  let data;
  try {
    const res = await fetch("data/announcements.json", { cache: "no-store" });
    data = await res.json();
  } catch (e) {
    list.innerHTML = `<div class="state-msg">Couldn't load announcements right now.</div>`;
    return;
  }

  const items = (data.items || []).sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  if (!items.length) {
    list.innerHTML = `<div class="state-msg">No announcements posted yet.</div>`;
    return;
  }

  list.innerHTML = items
    .map((a) => {
      const d = new Date(a.date);
      const day = isNaN(d) ? "--" : d.getDate();
      const mon = isNaN(d)
        ? ""
        : d.toLocaleDateString("en-US", { month: "short" });
      return `
      <div class="announce-item ${a.pinned ? "pinned" : ""}">
        <div class="announce-date"><span class="day">${day}</span><span class="mon">${mon}</span></div>
        <div>
          ${a.pinned ? `<div class="pin-flag">📌 Pinned</div>` : ""}
          <h3 style="margin-bottom:4px;font-size:1.05rem;">${escapeHtml(a.title)}</h3>
          <p style="margin:0;">${escapeHtml(a.body)}</p>
        </div>
      </div>`;
    })
    .join("");
}

/* ---------------- Events (events.html) ---------------- */
async function initEvents() {
  const list = document.querySelector("#event-list");
  if (!list) return;

  let events = [];
  try {
    const res = await fetch("data/events.json", { cache: "no-store" });
    const data = await res.json();
    events = data.events || [];
  } catch (e) {
    list.innerHTML = `<div class="state-msg">Couldn't load events right now.</div>`;
    return;
  }

  const now = new Date();
  events = events
    .filter((ev) => !isNaN(new Date(ev.date)))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!events.length) {
    list.innerHTML = `<div class="state-msg">No events scheduled yet - check back soon.</div>`;
    return;
  }

  list.innerHTML = events
    .map((ev) => {
      const d = new Date(ev.date);
      const past = d < now;
      return `
      <div class="announce-item ${past ? "" : "pinned"}">
        <div class="announce-date">
          <span class="day">${d.getDate()}</span>
          <span class="mon">${d.toLocaleDateString("en-US", { month: "short" })}</span>
        </div>
        <div>
          <h3 style="margin-bottom:4px;font-size:1.05rem;">${escapeHtml(ev.title)}</h3>
          <div class="meta" style="margin-bottom:6px;">${escapeHtml(ev.time || "")}${ev.time && ev.location ? " · " : ""}${escapeHtml(ev.location || "")}</div>
          <p style="margin:0;">${escapeHtml(ev.body || "")}</p>
        </div>
      </div>`;
    })
    .join("");
}

/* ---------------- Leadership (leadership.html) ---------------- */
async function initLeadership() {
  const grid = document.querySelector("#leadership-grid");
  if (!grid) return;

  let team = [];
  try {
    const res = await fetch("data/leadership.json", { cache: "no-store" });
    const data = await res.json();
    team = data.leaders || [];
  } catch (e) {
    grid.innerHTML = `<div class="state-msg">Couldn't load the team list right now.</div>`;
    return;
  }

  grid.innerHTML = team
    .map(
      (p) => `
    <div class="arch-card" style="text-align:center;">
      <img src="${escapeAttr(p.photo || "assets/avatar-placeholder.png")}"
           onerror="this.src='assets/avatar-placeholder.png'"
           alt="${escapeAttr(p.name)}"
           style="width:88px;height:88px;border-radius:50%;object-fit:cover;margin:0 auto 14px;border:3px solid var(--mist);">
      <h3>${escapeHtml(p.name)}</h3>
      <div class="meta">${escapeHtml(p.role)}</div>
      <p>${escapeHtml(p.bio || "")}</p>
    </div>`
    )
    .join("");
}

/* ---------------- Contact / prayer-request form (contact.html) ----------------
   Client-side only for now - shows a confirmation but sends nothing anywhere.
   Wire this up to a Cloudflare Pages Function, Formspree, or similar to make
   it actually deliver messages. See README. */
function initContactForm() {
  const form = document.querySelector("#contact-form");
  if (!form) return;
  const status = document.querySelector("#contact-form-status");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = form.querySelector("#cf-name")?.value.trim();
    if (!name) return;
    status.textContent =
      "Thanks, " + name.split(" ")[0] + " - this demo form doesn't send anywhere yet. Connect it to a backend (see README) to receive messages for real.";
    status.style.display = "block";
    form.reset();
  });
}

/* ---------------- Home page teasers (latest sermon + top announcement) ---------------- */
async function initHomeTeasers() {
  const sermonTeaser = document.querySelector("#home-sermon-teaser");
  const announceTeaser = document.querySelector("#home-announce-teaser");
  if (!sermonTeaser && !announceTeaser) return;

  try {
    const [sermonsRes, announceRes] = await Promise.all([
      fetch("data/sermons.json", { cache: "no-store" }),
      fetch("data/announcements.json", { cache: "no-store" }),
    ]);
    const sermonsData = await sermonsRes.json();
    const sermons = sermonsData.sermons || [];
    const announceData = await announceRes.json();

    if (sermonTeaser) {
      const latest = [...sermons].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      )[0];
      if (latest) {
        sermonTeaser.innerHTML = `
          <span class="tag">Latest sermon</span>
          <h3>${escapeHtml(latest.title)}</h3>
          <div class="meta">${escapeHtml(latest.preacher)} · ${formatDate(latest.date)}</div>
          <div class="audio-row"><audio controls preload="none" src="${escapeAttr(latest.audioUrl)}"></audio></div>`;
      }
    }

    if (announceTeaser) {
      const top = (announceData.items || []).sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      )[0];
      if (top) {
        announceTeaser.innerHTML = `
          <span class="tag">Latest announcement</span>
          <h3>${escapeHtml(top.title)}</h3>
          <p>${escapeHtml(top.body)}</p>
          <a href="assets/bulletin.pdf" target="_blank" style="font-size:.85rem;font-weight:600;color:var(--royal-2);">Download this week's bulletin (PDF) ↓</a>`;
      }
    }
  } catch (e) {
    /* silently leave the static placeholder markup in the HTML */
  }
}

/* ---------------- Photo gallery - auto-fill from /assets/gallery ----------------
   No JSON to edit. Drop files named slide-1.jpg, slide-2.jpg, slide-3.jpg... into
   assets/gallery/ (jpg, jpeg, png, or webp) and they show up automatically, in
   order, next time the page loads. Stops at the first missing number, so keep
   the numbering contiguous (1, 2, 3 - not 1, 3, 5). */
async function initGallery() {
  const el = document.querySelector("#slideshow");
  const track = document.querySelector("#slideshow-track");
  const dotsWrap = document.querySelector("#slide-dots");
  const prevBtn = document.querySelector("#slide-prev");
  const nextBtn = document.querySelector("#slide-next");
  if (!el || !track) return;

  const EXTENSIONS = ["jpg", "jpeg", "png", "webp", "JPG", "JPEG", "PNG", "WEBP"];
  const MAX_SLIDES = 25;

  function tryLoad(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(src);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  const found = [];
  for (let i = 1; i <= MAX_SLIDES; i++) {
    const candidates = EXTENSIONS.map((ext) => `assets/gallery/slide-${i}.${ext}`);
    const results = await Promise.all(candidates.map(tryLoad));
    const hit = results.find((r) => r);
    if (!hit) break; // stop at first missing number - keeps numbering simple
    found.push(hit);
  }

  if (!found.length) {
    track.innerHTML = `<div class="state-msg">No photos yet - add slide-1.jpg, slide-2.jpg… to assets/gallery/</div>`;
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    return;
  }

  track.innerHTML = found
    .map(
      (src, i) =>
        `<div class="slide${i === 0 ? " active" : ""}"><img src="${src}" alt="Photo from church life, ${i + 1} of ${found.length}"></div>`
    )
    .join("");
  dotsWrap.innerHTML = found
    .map((_, i) => `<button data-i="${i}" aria-label="Go to photo ${i + 1}" class="${i === 0 ? "active" : ""}"></button>`)
    .join("");

  if (found.length === 1) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    return;
  }

  let current = 0;
  const slides = track.querySelectorAll(".slide");
  const dots = dotsWrap.querySelectorAll("button");

  function show(i) {
    current = (i + found.length) % found.length;
    slides.forEach((s, idx) => s.classList.toggle("active", idx === current));
    dots.forEach((d, idx) => d.classList.toggle("active", idx === current));
  }

  prevBtn.addEventListener("click", () => { show(current - 1); resetTimer(); });
  nextBtn.addEventListener("click", () => { show(current + 1); resetTimer(); });
  dots.forEach((d) => d.addEventListener("click", () => { show(Number(d.dataset.i)); resetTimer(); }));

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let timer;
  function startTimer() {
    if (reduceMotion) return;
    timer = setInterval(() => show(current + 1), 5000);
  }
  function resetTimer() {
    clearInterval(timer);
    startTimer();
  }
  el.addEventListener("mouseenter", () => clearInterval(timer));
  el.addEventListener("mouseleave", startTimer);
  startTimer();
}

/* ---------------- utils ---------------- */
function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso || "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(str = "") {
  return str.replace(/"/g, "&quot;");
}
