// ==========================================================================
// Cape Town Christian Tabernacle - Radio page
// Talks to an Icecast server's /status-json.xsl for live "now playing" data.
// See README.md for the Nginx/CORS config this depends on.
// ==========================================================================

const RADIO_CONFIG = {
  // Base URL of your Icecast server (no trailing slash)
  icecastBase: "https://radio.christiantabernacle.co.za",
  // Mount points per quality - edit to match your Icecast <mount> setup.
  // Currently only one real mount (/stream) exists, so all three quality
  // buttons point at it for now - see README.md section 5 for how to add
  // separate high/low bitrate mounts later if you want real quality options.
  streams: {
    "320": "/stream",
    "128": "/stream",
    "64": "/stream"
  },
  statusPath: "/status-json.xsl",
  pollMs: 15000,
};

document.addEventListener("DOMContentLoaded", () => {
  initModeToggle();
  initPlayer();
  initSchedule();
  initChatDemo();
});

/* ---------------- Dark / light mode ---------------- */
function initModeToggle() {
  const btn = document.querySelector("#mode-toggle");
  if (!btn) return;
  const saved = localStorage.getItem("ctct-radio-theme");
  if (saved === "light") document.body.classList.add("light-mode");
  updateModeIcon(btn);

  btn.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    localStorage.setItem(
      "ctct-radio-theme",
      document.body.classList.contains("light-mode") ? "light" : "dark"
    );
    updateModeIcon(btn);
  });
}
function updateModeIcon(btn) {
  btn.textContent = document.body.classList.contains("light-mode") ? "🌙" : "☀️";
}

/* ---------------- Player ---------------- */
function initPlayer() {
  const audio = document.querySelector("#radio-audio");
  const playBtn = document.querySelector("#play-btn");
  const volSlider = document.querySelector("#vol-slider");
  const eq = document.querySelector("#equalizer");
  const liveBadge = document.querySelector("#live-badge");
  const npTitle = document.querySelector("#np-title");
  const npSub = document.querySelector("#np-sub");
  const listenerCount = document.querySelector("#listener-count");
  const qualityBtns = document.querySelectorAll(".quality-row button");
  if (!audio || !playBtn) return;

  let currentQuality = "128";
  audio.src = RADIO_CONFIG.icecastBase + RADIO_CONFIG.streams[currentQuality];
  audio.volume = 0.8;

  playBtn.addEventListener("click", () => {
    if (audio.paused) {
      audio.play().catch(() => {
        npSub.textContent = "Couldn't connect to the stream - is Icecast running?";
      });
    } else {
      audio.pause();
    }
  });
  audio.addEventListener("play", () => {
    playBtn.textContent = "⏸";
    eq.classList.remove("paused");
    liveBadge.style.display = "inline-flex";
  });
  audio.addEventListener("pause", () => {
    playBtn.textContent = "▶";
    eq.classList.add("paused");
  });

  volSlider?.addEventListener("input", (e) => {
    audio.volume = Number(e.target.value) / 100;
  });

  qualityBtns.forEach((b) =>
    b.addEventListener("click", () => {
      qualityBtns.forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      const quality = b.dataset.quality;
      if (quality === currentQuality) return;
      const wasPlaying = !audio.paused;
      currentQuality = quality;
      audio.src = RADIO_CONFIG.icecastBase + RADIO_CONFIG.streams[quality];
      if (wasPlaying) audio.play().catch(() => {});
    })
  );

  pollStatus();
  setInterval(pollStatus, RADIO_CONFIG.pollMs);

  async function pollStatus() {
    try {
      const res = await fetch(RADIO_CONFIG.icecastBase + RADIO_CONFIG.statusPath, {
        cache: "no-store",
      });
      const data = await res.json();
      const src = Array.isArray(data.icestats.source)
        ? data.icestats.source[0]
        : data.icestats.source;
      if (!src) throw new Error("no source");

      const title = src.title || src.yp_currently_playing || "Live broadcast";
      const [artist, song] = title.includes(" - ")
        ? title.split(" - ")
        : [null, title];

      npTitle.textContent = song || title;
      npSub.textContent = artist || src.server_name || "Cape Town Christian Tabernacle Radio";
      if (listenerCount) listenerCount.textContent = src.listeners ?? "-";
    } catch (e) {
      // Icecast unreachable, offline, or CORS not yet configured.
      npSub.textContent = "Metadata unavailable right now - the stream will still play.";
      if (listenerCount) listenerCount.textContent = "-";
    }
  }
}

/* ---------------- Schedule ---------------- */
async function initSchedule() {
  const table = document.querySelector("#schedule-body");
  if (!table) return;
  try {
    const res = await fetch("data/schedule.json", { cache: "no-store" });
    const data = await res.json();
    const schedule = data.schedule || [];
    table.innerHTML = schedule
      .map(
        (row) => `<tr><td class="time">${row.time}</td><td>${row.day}</td><td>${row.program}</td><td>${row.host}</td></tr>`
      )
      .join("");
  } catch (e) {
    table.innerHTML = `<tr><td colspan="4" class="state-msg">Schedule coming soon.</td></tr>`;
  }
}

/* ---------------- Lightweight demo chat ----------------
   Client-only placeholder so the page isn't broken out of the box.
   For real live chat across listeners, wire this to a small backend
   (Cloudflare Worker + Durable Object, or a service like Firebase). */
function initChatDemo() {
  const form = document.querySelector("#chat-form");
  const messages = document.querySelector("#chat-messages");
  if (!form || !messages) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = form.querySelector("input");
    const val = input.value.trim();
    if (!val) return;
    const div = document.createElement("div");
    div.className = "chat-msg";
    div.innerHTML = `<b>You:</b> ${val.replace(/</g, "&lt;")}`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    input.value = "";
  });
}
