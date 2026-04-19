/* =========================================================================
 * YouTube Search Explorer — front-end
 * ========================================================================= */

// ----- Elements --------------------------------------------------------
const form = document.getElementById("search-form");
const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");
const meta = document.getElementById("meta");
const pagination = document.getElementById("pagination");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");

const modal = document.getElementById("modal");
const modalPlayer = document.getElementById("modal-player");
const modalMeta = document.getElementById("modal-meta");
const modalClose = document.getElementById("modal-close");
const modalBackdrop = modal.querySelector(".modal-backdrop");
const modalComments = document.getElementById("modal-comments");
const modalRelated = document.getElementById("modal-related");

const quotaUsedEl = document.getElementById("quota-used");
const quotaResetBtn = document.getElementById("quota-reset");

const sortSelect = document.getElementById("sort-select");
const viewSelect = document.getElementById("view-select");
const hideWatchedCb = document.getElementById("hide-watched");
const onlyStarredCb = document.getElementById("only-starred");
const btnRefresh = document.getElementById("btn-refresh");
const btnInsights = document.getElementById("btn-insights");
const btnExportCsv = document.getElementById("btn-export-csv");
const btnExportJson = document.getElementById("btn-export-json");
const btnCopyUrls = document.getElementById("btn-copy-urls");
const btnCopyIds = document.getElementById("btn-copy-ids");
const btnClearWatched = document.getElementById("btn-clear-watched");
const insightsPanel = document.getElementById("insights");

const savedSelect = document.getElementById("saved-select");
const savedName = document.getElementById("saved-name");
const savedSaveBtn = document.getElementById("saved-save");
const savedLoadBtn = document.getElementById("saved-load");
const savedDeleteBtn = document.getElementById("saved-delete");

const autoplayQueueCb = document.getElementById("autoplay-queue");
const speedButtons = document.getElementById("speed-buttons");
const clipStart = document.getElementById("clip-start");
const clipEnd = document.getElementById("clip-end");
const clipApplyBtn = document.getElementById("clip-apply");

// ----- State -----------------------------------------------------------
const HOVER_DELAY_MS = 600;
let currentTokens = { prev: null, next: null };
let lastResults = [];        // raw from API
let displayedResults = [];   // after client-side filtering/sorting
let focusedIdx = -1;
let currentModalItem = null;
let ytPlayer = null;
let lastModalClip = { start: null, end: null };

// ----- LocalStorage wrappers ------------------------------------------
const LS = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
};
const WATCHED_KEY = "ytx.watched";
const STARRED_KEY = "ytx.starred";
const SAVED_KEY = "ytx.savedSearches";
const PREFS_KEY = "ytx.prefs";
const CACHE_KEY = "ytx.lastSearch";   // sessionStorage — survives refresh, not tab close

function getSet(key) { return new Set(LS.get(key, [])); }
function saveSet(key, set) { LS.set(key, Array.from(set)); }

// ----- Utilities -------------------------------------------------------
function formatNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return n ?? "";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return num.toLocaleString();
}

function formatDuration(iso) {
  if (!iso) return "";
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return "";
  const [, h, mi, s] = m;
  const parts = [];
  if (h) parts.push(h);
  parts.push((mi || "0").padStart(h ? 2 : 1, "0"));
  parts.push((s || "0").padStart(2, "0"));
  return parts.join(":");
}

function isoDurationSeconds(iso) {
  if (!iso) return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  const [, h, mi, s] = m;
  return (Number(h) || 0) * 3600 + (Number(mi) || 0) * 60 + (Number(s) || 0);
}

function parseClip(raw) {
  if (!raw) return null;
  raw = raw.trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  const parts = raw.split(":").map(Number);
  if (parts.some((x) => isNaN(x))) return null;
  while (parts.length < 3) parts.unshift(0);
  const [h, m, s] = parts;
  return h * 3600 + m * 60 + s;
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch { return iso; }
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function download(filename, content, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function copyText(text) {
  navigator.clipboard?.writeText(text).then(
    () => toast("Copied!"),
    () => toast("Copy failed"),
  );
}

let toastTimer = null;
function toast(msg) {
  statusEl.className = "status";
  statusEl.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { if (statusEl.textContent === msg) statusEl.textContent = ""; }, 1500);
}

// ----- Form <-> URL hash synchronization ------------------------------
function formToObject() {
  const fd = new FormData(form);
  const obj = {};
  for (const [k, v] of fd.entries()) {
    if (v !== "" && v != null) obj[k] = v;
  }
  return obj;
}

function applyObjectToForm(obj) {
  form.reset();
  for (const [k, v] of Object.entries(obj || {})) {
    const el = form.elements.namedItem(k);
    if (el) el.value = v;
  }
}

function writeHash(obj) {
  const params = new URLSearchParams(obj);
  const s = params.toString();
  if (s) history.replaceState(null, "", "#" + s);
  else history.replaceState(null, "", location.pathname);
}

function readHash() {
  if (!location.hash || location.hash.length < 2) return null;
  const params = new URLSearchParams(location.hash.slice(1));
  const obj = {};
  for (const [k, v] of params.entries()) obj[k] = v;
  return obj;
}

// ----- Saved searches --------------------------------------------------
function refreshSavedSelect() {
  const saved = LS.get(SAVED_KEY, {});
  savedSelect.innerHTML = `<option value="">— pick saved search —</option>` +
    Object.keys(saved).sort().map(
      (name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`
    ).join("");
}

savedSaveBtn.addEventListener("click", () => {
  const name = savedName.value.trim();
  if (!name) { toast("Enter a name first"); return; }
  const saved = LS.get(SAVED_KEY, {});
  saved[name] = formToObject();
  LS.set(SAVED_KEY, saved);
  refreshSavedSelect();
  savedSelect.value = name;
  toast(`Saved "${name}"`);
});

savedLoadBtn.addEventListener("click", () => {
  const name = savedSelect.value;
  if (!name) return;
  const saved = LS.get(SAVED_KEY, {});
  if (!saved[name]) return;
  applyObjectToForm(saved[name]);
  savedName.value = name;
  runSearch("");
});

savedDeleteBtn.addEventListener("click", () => {
  const name = savedSelect.value;
  if (!name) return;
  const saved = LS.get(SAVED_KEY, {});
  delete saved[name];
  LS.set(SAVED_KEY, saved);
  refreshSavedSelect();
});

// ----- Preferences -----------------------------------------------------
function loadPrefs() {
  const p = LS.get(PREFS_KEY, {});
  if (p.view) viewSelect.value = p.view;
  if (p.sort) sortSelect.value = p.sort;
  if (p.hideWatched) hideWatchedCb.checked = p.hideWatched;
  if (p.onlyStarred) onlyStarredCb.checked = p.onlyStarred;
  if (p.autoplayQueue) autoplayQueueCb.checked = p.autoplayQueue;
  applyViewMode();
}

function savePrefs() {
  LS.set(PREFS_KEY, {
    view: viewSelect.value,
    sort: sortSelect.value,
    hideWatched: hideWatchedCb.checked,
    onlyStarred: onlyStarredCb.checked,
    autoplayQueue: autoplayQueueCb.checked,
  });
}

function applyViewMode() {
  grid.classList.remove("compact", "list");
  if (viewSelect.value === "compact") grid.classList.add("compact");
  if (viewSelect.value === "list") grid.classList.add("list");
}

[sortSelect, viewSelect, hideWatchedCb, onlyStarredCb, autoplayQueueCb].forEach((el) =>
  el.addEventListener("change", () => {
    savePrefs();
    if (el === viewSelect) applyViewMode();
    if (el !== autoplayQueueCb) renderFromState();
  }));

// ----- Video categories -----------------------------------------------
const categorySelect = document.getElementById("video-category-select");
const regionInput = form.elements.namedItem("regionCode");
let categoriesLoadedFor = null;

async function loadCategories(regionCode) {
  const region = (regionCode || "US").toUpperCase() || "US";
  if (categoriesLoadedFor === region) return;
  try {
    const r = await fetch(`/api/categories?regionCode=${encodeURIComponent(region)}`);
    const d = await r.json();
    if (!r.ok || !Array.isArray(d.items)) return;
    const previous = categorySelect.value;
    categorySelect.innerHTML = `<option value="">Any category</option>` +
      d.items.map((c) =>
        `<option value="${escapeHtml(c.id)}"${c.assignable ? "" : " disabled style='color:#666'"}>${escapeHtml(c.title)}${c.assignable ? "" : " (not assignable)"}</option>`
      ).join("");
    if (previous) categorySelect.value = previous;
    categoriesLoadedFor = region;
    refreshQuota();
  } catch {
    // Fall back to the static list already in the DOM.
  }
}

if (regionInput) {
  regionInput.addEventListener("change", () => loadCategories(regionInput.value));
  regionInput.addEventListener("blur", () => loadCategories(regionInput.value));
}

// ----- Quota meter -----------------------------------------------------
async function refreshQuota() {
  try {
    const r = await fetch("/api/quota");
    const d = await r.json();
    quotaUsedEl.textContent = (d.used || 0).toLocaleString();
  } catch {}
}

quotaResetBtn.addEventListener("click", async () => {
  await fetch("/api/reset-quota", { method: "POST" });
  refreshQuota();
});

// ----- Rendering -------------------------------------------------------
function sortResults(items, mode) {
  if (!mode) return items;
  const get = {
    "views-desc":     (i) => -Number(i.statistics?.viewCount || 0),
    "views-asc":      (i) =>  Number(i.statistics?.viewCount || 0),
    "likes-desc":     (i) => -Number(i.statistics?.likeCount || 0),
    "comments-desc":  (i) => -Number(i.statistics?.commentCount || 0),
    "duration-desc":  (i) => -(isoDurationSeconds(i.duration) || 0),
    "duration-asc":   (i) =>   isoDurationSeconds(i.duration) || 0,
    "published-desc": (i) => -(new Date(i.publishedAt || 0).getTime()),
    "published-asc":  (i) =>   new Date(i.publishedAt || 0).getTime(),
    "title-asc":      (i) =>   (i.title || "").toLowerCase(),
    "likeratio-desc": (i) => {
      const v = Number(i.statistics?.viewCount || 0);
      const l = Number(i.statistics?.likeCount || 0);
      return v ? -(l / v) : 0;
    },
  }[mode];
  if (!get) return items;
  return [...items].sort((a, b) => {
    const av = get(a), bv = get(b);
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });
}

function applyClientFilters(items) {
  let out = items;
  const watched = getSet(WATCHED_KEY);
  const starred = getSet(STARRED_KEY);
  if (hideWatchedCb.checked) {
    out = out.filter((i) => !watched.has(i.id));
  }
  if (onlyStarredCb.checked) {
    out = out.filter((i) => starred.has(i.id));
  }
  return out;
}

function renderFromState() {
  displayedResults = sortResults(applyClientFilters(lastResults), sortSelect.value);
  focusedIdx = -1;
  renderItems(displayedResults);
}

function cardHtml(item, starred) {
  const stats = item.statistics || {};
  const pills = [];
  if (stats.viewCount) pills.push(`<span class="stat">${formatNumber(stats.viewCount)} views</span>`);
  if (stats.likeCount) pills.push(`<span class="stat">${formatNumber(stats.likeCount)} likes</span>`);
  if (stats.commentCount) pills.push(`<span class="stat">${formatNumber(stats.commentCount)} comments</span>`);
  if (item.duration) pills.push(`<span class="stat">${formatDuration(item.duration)}</span>`);
  if (item.publishedAt) pills.push(`<span class="stat">${formatDate(item.publishedAt)}</span>`);
  if (item.channelStats?.subscriberCount) {
    pills.push(`<span class="stat">${formatNumber(item.channelStats.subscriberCount)} subs</span>`);
  }

  const isVideo = item.kind === "video";
  const thumb = `
    <div class="thumb-wrap">
      ${item.thumbnail
        ? `<img class="thumb" src="${item.thumbnail}" alt="" loading="lazy" />`
        : `<div class="thumb"></div>`}
      <span class="kind-badge">${item.kind}</span>
      ${isVideo ? `<div class="play-overlay"></div>` : ""}
      <button type="button" class="star-btn" data-star="${item.id}" title="Star">${starred ? "★" : "☆"}</button>
    </div>`;
  const body = `
    <div class="body">
      <h3 class="title">${escapeHtml(item.title)}</h3>
      <div class="channel">${escapeHtml(item.channelTitle || "")}</div>
      <div class="desc">${escapeHtml(item.description || "")}</div>
      <div class="stats">${pills.join("")}</div>
    </div>`;
  return { thumb, body };
}

function renderItems(items) {
  grid.innerHTML = "";
  if (!items.length) {
    grid.innerHTML = `<div class="status">No results match current filters.</div>`;
    return;
  }
  const watched = getSet(WATCHED_KEY);
  const starred = getSet(STARRED_KEY);

  items.forEach((item, idx) => {
    const card = document.createElement("article");
    card.className = "card";
    if (item.kind === "video") card.classList.add("playable");
    if (watched.has(item.id)) card.classList.add("watched");
    if (starred.has(item.id)) card.classList.add("starred");
    card.dataset.idx = String(idx);
    card.dataset.id = item.id || "";
    card.dataset.kind = item.kind;

    const { thumb, body } = cardHtml(item, starred.has(item.id));
    const href = item.url || "#";
    card.innerHTML = `<a href="${href}" target="_blank" rel="noopener" class="card-link">${thumb}${body}</a>`;
    if (item.kind === "video") {
      const link = card.querySelector(".card-link");
      link.addEventListener("click", (e) => {
        if (e.target.closest(".star-btn")) return;
        // Let ctrl/meta/shift/middle-click use the browser's default (new tab/window).
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
        e.preventDefault();
        openModal(item, idx);
      });
    }

    // Star button
    const star = card.querySelector(".star-btn");
    if (star) {
      star.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleStar(item.id, card);
      });
    }

    grid.appendChild(card);
    attachHoverPreview(card, item);
  });
}

function toggleStar(id, card) {
  if (!id) return;
  const starred = getSet(STARRED_KEY);
  if (starred.has(id)) starred.delete(id);
  else starred.add(id);
  saveSet(STARRED_KEY, starred);
  if (card) {
    card.classList.toggle("starred", starred.has(id));
    const btn = card.querySelector(".star-btn");
    if (btn) btn.textContent = starred.has(id) ? "★" : "☆";
  }
  if (onlyStarredCb.checked) renderFromState();
}

function attachHoverPreview(card, item) {
  if (item.kind !== "video" || !item.id) return;
  const wrap = card.querySelector(".thumb-wrap");
  let timer = null;
  let iframe = null;

  wrap.addEventListener("mouseenter", () => {
    timer = setTimeout(() => {
      iframe = document.createElement("iframe");
      iframe.className = "hover-frame";
      iframe.allow = "autoplay";
      iframe.src = `https://www.youtube.com/embed/${item.id}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&playsinline=1`;
      wrap.appendChild(iframe);
      requestAnimationFrame(() => iframe.classList.add("active"));
    }, HOVER_DELAY_MS);
  });
  wrap.addEventListener("mouseleave", () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (iframe) { iframe.remove(); iframe = null; }
  });
}

// ----- Modal / player --------------------------------------------------
function onYouTubeIframeAPIReady() { /* player created per open */ }
window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

function openModal(item, idx = -1) {
  if (item.kind !== "video" || !item.id) {
    window.open(item.url, "_blank", "noopener");
    return;
  }
  currentModalItem = { ...item, _idx: idx };
  lastModalClip = { start: null, end: null };

  const watched = getSet(WATCHED_KEY);
  watched.add(item.id);
  saveSet(WATCHED_KEY, watched);

  modalPlayer.innerHTML = `<div id="yt-player-host"></div>`;
  ytPlayer = new YT.Player("yt-player-host", {
    videoId: item.id,
    playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
    events: {
      onStateChange: (e) => {
        // 0 = ended
        if (e.data === 0 && autoplayQueueCb.checked) playNextInQueue();
      },
      onReady: () => {
        resetSpeedButtons();
      },
    },
  });

  modalMeta.innerHTML = `
    <h3>${escapeHtml(item.title)}</h3>
    <div class="channel">${escapeHtml(item.channelTitle || "")}</div>
    <a class="open-yt" href="${item.url}" target="_blank" rel="noopener">Open on YouTube →</a>
  `;
  modalComments.innerHTML = `<h4>Top comments</h4><div class="status">Loading…</div>`;
  modalRelated.innerHTML = `<h4>More from this channel</h4><div class="status">Loading…</div>`;
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  clipStart.value = "";
  clipEnd.value = "";

  loadComments(item.id);
  loadChannelVideos(item.channelId, item.id);

  if (idx >= 0) {
    const cards = grid.querySelectorAll(".card");
    if (cards[idx]) cards[idx].classList.add("watched");
  }
}

function closeModal() {
  modal.classList.add("hidden");
  try { ytPlayer?.destroy?.(); } catch {}
  ytPlayer = null;
  modalPlayer.innerHTML = "";
  modalMeta.innerHTML = "";
  modalComments.innerHTML = "";
  modalRelated.innerHTML = "";
  document.body.style.overflow = "";
  currentModalItem = null;
}

function playNextInQueue() {
  if (!currentModalItem || currentModalItem._idx < 0) { closeModal(); return; }
  const next = displayedResults
    .slice(currentModalItem._idx + 1)
    .find((i) => i.kind === "video" && i.id);
  if (!next) { closeModal(); return; }
  const nextIdx = displayedResults.indexOf(next);
  openModal(next, nextIdx);
}

modalClose.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
});

// Speed control
function resetSpeedButtons() {
  speedButtons.querySelectorAll("button").forEach((b) =>
    b.classList.toggle("active", b.dataset.speed === "1"));
}
speedButtons.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-speed]");
  if (!btn || !ytPlayer?.setPlaybackRate) return;
  const rate = Number(btn.dataset.speed);
  ytPlayer.setPlaybackRate(rate);
  speedButtons.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
});

// Clip (start/end)
clipApplyBtn.addEventListener("click", () => {
  if (!currentModalItem || !ytPlayer?.loadVideoById) return;
  const start = parseClip(clipStart.value) ?? 0;
  const end = parseClip(clipEnd.value);
  lastModalClip = { start, end };
  const opts = { videoId: currentModalItem.id, startSeconds: start };
  if (end != null) opts.endSeconds = end;
  ytPlayer.loadVideoById(opts);
});

// ----- Comments / related ---------------------------------------------
async function loadComments(videoId) {
  try {
    const r = await fetch(`/api/comments?videoId=${encodeURIComponent(videoId)}`);
    const d = await r.json();
    if (!r.ok) {
      modalComments.innerHTML = `<h4>Top comments</h4><div class="status">Couldn't load: ${escapeHtml(d.error || r.statusText)}</div>`;
      return;
    }
    refreshQuota();
    if (!d.items.length) {
      modalComments.innerHTML = `<h4>Top comments</h4><div class="status">No comments.</div>`;
      return;
    }
    modalComments.innerHTML = `<h4>Top comments</h4>` + d.items.map((c) => `
      <div class="comment">
        ${c.authorImage ? `<img src="${c.authorImage}" alt="" />` : ""}
        <div>
          <div class="author">${escapeHtml(c.author)}</div>
          <div class="text">${c.text}</div>
          <div class="meta2">${formatNumber(c.likeCount)} likes · ${formatDate(c.publishedAt)}</div>
        </div>
      </div>
    `).join("");
  } catch (e) {
    modalComments.innerHTML = `<h4>Top comments</h4><div class="status">${escapeHtml(e.message)}</div>`;
  }
}

async function loadChannelVideos(channelId, currentId) {
  if (!channelId) { modalRelated.innerHTML = ""; return; }
  try {
    const r = await fetch(`/api/channel-videos?channelId=${encodeURIComponent(channelId)}`);
    const d = await r.json();
    if (!r.ok) {
      modalRelated.innerHTML = `<h4>More from this channel</h4><div class="status">Couldn't load: ${escapeHtml(d.error || r.statusText)}</div>`;
      return;
    }
    refreshQuota();
    const items = d.items.filter((i) => i.id && i.id !== currentId).slice(0, 8);
    if (!items.length) { modalRelated.innerHTML = ""; return; }
    modalRelated.innerHTML = `<h4>More from this channel</h4><div class="related-list">` +
      items.map((i) => `
        <div class="related-item" data-id="${i.id}">
          ${i.thumbnail ? `<img src="${i.thumbnail}" alt="" />` : ""}
          <div class="r-title">${escapeHtml(i.title)}</div>
        </div>
      `).join("") + `</div>`;
    modalRelated.querySelectorAll(".related-item").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.id;
        const found = d.items.find((x) => x.id === id);
        if (found) openModal({
          kind: "video",
          id: found.id,
          title: found.title,
          channelTitle: found.channelTitle,
          channelId,
          url: `https://www.youtube.com/watch?v=${found.id}`,
          publishedAt: found.publishedAt,
          thumbnail: found.thumbnail,
          description: "",
        }, -1);
      });
    });
  } catch (e) {
    modalRelated.innerHTML = "";
  }
}

// ----- Insights --------------------------------------------------------
btnInsights.addEventListener("click", () => {
  insightsPanel.classList.toggle("hidden");
  if (!insightsPanel.classList.contains("hidden")) renderInsights();
});

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function renderInsights() {
  const vids = displayedResults.filter((i) => i.kind === "video");
  if (!vids.length) {
    insightsPanel.innerHTML = `<h3>Insights</h3><div class="status">Run a search with videos to see insights.</div>`;
    return;
  }
  const views = vids.map((v) => Number(v.statistics?.viewCount || 0));
  const likes = vids.map((v) => Number(v.statistics?.likeCount || 0));
  const comments = vids.map((v) => Number(v.statistics?.commentCount || 0));
  const durations = vids.map((v) => isoDurationSeconds(v.duration) || 0);
  const totalViews = views.reduce((a, b) => a + b, 0);
  const totalLikes = likes.reduce((a, b) => a + b, 0);
  const totalRuntime = durations.reduce((a, b) => a + b, 0);

  const avgViews = totalViews / vids.length;
  const medDuration = median(durations);

  // Top channels
  const chCount = {};
  vids.forEach((v) => { chCount[v.channelTitle] = (chCount[v.channelTitle] || 0) + 1; });
  const topChannels = Object.entries(chCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxCh = topChannels[0]?.[1] || 1;

  // Duration histogram: 10 buckets between min and max
  const minD = Math.min(...durations), maxD = Math.max(...durations);
  const bucketCount = 10;
  const bucketSize = Math.max(1, (maxD - minD) / bucketCount);
  const buckets = new Array(bucketCount).fill(0);
  durations.forEach((d) => {
    const idx = Math.min(bucketCount - 1, Math.floor((d - minD) / bucketSize));
    buckets[idx]++;
  });
  const maxBucket = Math.max(...buckets, 1);
  const formatSec = (s) => s >= 3600 ? `${Math.round(s / 3600)}h` : s >= 60 ? `${Math.round(s / 60)}m` : `${s}s`;

  // Upload heatmap: 7 x 24
  const heat = Array.from({ length: 7 }, () => new Array(24).fill(0));
  vids.forEach((v) => {
    if (!v.publishedAt) return;
    const d = new Date(v.publishedAt);
    heat[d.getDay()][d.getHours()]++;
  });
  const maxHeat = Math.max(...heat.flat(), 1);
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  insightsPanel.innerHTML = `
    <h3>Insights (current view)</h3>
    <div class="insights-grid">
      <div class="stat-card"><div class="label">Videos</div><div class="value">${vids.length}</div></div>
      <div class="stat-card"><div class="label">Total views</div><div class="value">${formatNumber(totalViews)}</div></div>
      <div class="stat-card"><div class="label">Avg views</div><div class="value">${formatNumber(Math.round(avgViews))}</div></div>
      <div class="stat-card"><div class="label">Total likes</div><div class="value">${formatNumber(totalLikes)}</div></div>
      <div class="stat-card"><div class="label">Total runtime</div><div class="value">${formatDuration("PT" + Math.floor(totalRuntime/3600) + "H" + Math.floor((totalRuntime%3600)/60) + "M" + (totalRuntime%60) + "S")}</div></div>
      <div class="stat-card"><div class="label">Median duration</div><div class="value">${formatSec(Math.round(medDuration))}</div></div>
    </div>

    <div class="insights-section">
      <h4>Top channels</h4>
      <div class="top-channels">
        ${topChannels.map(([ch, n]) => `
          <div class="top-channel-row">
            <div style="flex:0 0 140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(ch)}</div>
            <div class="bar"><div style="width:${(n / maxCh) * 100}%"></div></div>
            <div class="count">${n}</div>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="insights-section">
      <h4>Duration distribution</h4>
      <div class="histogram">
        ${buckets.map((b) => `<div class="hist-bar" style="height:${(b / maxBucket) * 100}%" title="${b} videos"></div>`).join("")}
      </div>
      <div class="hist-labels">
        ${buckets.map((_, i) => `<div>${formatSec(Math.round(minD + i * bucketSize))}</div>`).join("")}
      </div>
    </div>

    <div class="insights-section">
      <h4>Upload time heatmap (local time)</h4>
      <div class="heatmap">
        <div></div>
        ${Array.from({ length: 24 }, (_, h) => `<div class="hm-label" style="text-align:center">${h}</div>`).join("")}
        ${heat.map((row, d) => `
          <div class="hm-label">${dayLabels[d]}</div>
          ${row.map((n) => `<div class="hm-cell" style="background:rgba(255,0,51,${n ? 0.2 + 0.8 * (n / maxHeat) : 0});" title="${n} uploads"></div>`).join("")}
        `).join("")}
      </div>
    </div>
  `;
}

// ----- Export / bulk copy ---------------------------------------------
function csvEscape(s) {
  if (s == null) return "";
  const str = String(s).replace(/"/g, '""');
  return `"${str}"`;
}
btnExportCsv.addEventListener("click", () => {
  if (!displayedResults.length) return;
  const headers = ["kind", "id", "title", "channelTitle", "channelId", "url", "publishedAt", "duration", "views", "likes", "comments", "subscribers"];
  const lines = [headers.join(",")];
  for (const i of displayedResults) {
    lines.push([
      i.kind, i.id, i.title, i.channelTitle, i.channelId, i.url, i.publishedAt,
      i.duration || "", i.statistics?.viewCount || "", i.statistics?.likeCount || "",
      i.statistics?.commentCount || "", i.channelStats?.subscriberCount || "",
    ].map(csvEscape).join(","));
  }
  download(`youtube-results-${Date.now()}.csv`, lines.join("\n"), "text/csv");
});

btnExportJson.addEventListener("click", () => {
  if (!displayedResults.length) return;
  download(`youtube-results-${Date.now()}.json`, JSON.stringify(displayedResults, null, 2), "application/json");
});

btnCopyUrls.addEventListener("click", () => {
  if (!displayedResults.length) return;
  copyText(displayedResults.map((i) => i.url).join("\n"));
});
btnCopyIds.addEventListener("click", () => {
  if (!displayedResults.length) return;
  copyText(displayedResults.map((i) => i.id).filter(Boolean).join("\n"));
});

btnClearWatched.addEventListener("click", () => {
  saveSet(WATCHED_KEY, new Set());
  document.querySelectorAll(".card.watched").forEach((c) => c.classList.remove("watched"));
  toast("Watched history cleared");
});

// ----- Keyboard navigation --------------------------------------------
document.addEventListener("keydown", (e) => {
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea") {
    if (e.key === "Enter" && e.target.form === form) {
      // handled by submit listener
      return;
    }
    return;
  }
  if (!modal.classList.contains("hidden")) return;
  const cards = grid.querySelectorAll(".card");
  if (e.key === "j" || e.key === "ArrowDown") {
    focusedIdx = Math.min(cards.length - 1, focusedIdx + 1);
    updateFocusedCard(cards);
    e.preventDefault();
  } else if (e.key === "k" || e.key === "ArrowUp") {
    focusedIdx = Math.max(0, focusedIdx - 1);
    updateFocusedCard(cards);
    e.preventDefault();
  } else if (e.key === "Enter" && focusedIdx >= 0) {
    const item = displayedResults[focusedIdx];
    if (item) openModal(item, focusedIdx);
  } else if (e.key === "s" && focusedIdx >= 0) {
    const item = displayedResults[focusedIdx];
    if (item) toggleStar(item.id, cards[focusedIdx]);
  } else if (e.key === "/") {
    form.elements.namedItem("q")?.focus();
    e.preventDefault();
  }
});

function updateFocusedCard(cards) {
  cards.forEach((c, i) => c.classList.toggle("focused", i === focusedIdx));
  cards[focusedIdx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// ----- Main search -----------------------------------------------------
function applySearchPayload(data, { fromCache = false } = {}) {
  const info = data.pageInfo || {};
  const filteredNote = data.filteredOut
    ? ` &nbsp;·&nbsp; <em>${data.filteredOut} filtered out</em>` : "";
  const paramSummary = Object.entries(data.requestParams || {})
    .filter(([k]) => k !== "part")
    .map(([k, v]) => `<strong>${k}</strong>=${escapeHtml(String(v))}`)
    .join(" &nbsp;·&nbsp; ");
  const cacheNote = fromCache ? ` &nbsp;·&nbsp; <em>cached — click Refresh to re-query</em>` : "";
  meta.innerHTML = `Showing ${data.items.length} of ~${info.totalResults || 0} results${filteredNote}${cacheNote} &nbsp;·&nbsp; ${paramSummary}`;
  meta.classList.remove("hidden");

  lastResults = data.items;
  renderFromState();
  if (!insightsPanel.classList.contains("hidden")) renderInsights();

  currentTokens = { prev: data.prevPageToken, next: data.nextPageToken };
  prevBtn.disabled = !currentTokens.prev;
  nextBtn.disabled = !currentTokens.next;
  if (currentTokens.prev || currentTokens.next) pagination.classList.remove("hidden");
  else pagination.classList.add("hidden");
}

function cacheSnapshot(params, pageToken, data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      params, pageToken, data, scrollY: window.scrollY, ts: Date.now(),
    }));
  } catch {}
}

function loadSnapshot() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function paramsEqual(a, b) {
  const keys = (o) => Object.keys(o || {}).sort();
  const ka = keys(a), kb = keys(b);
  if (ka.length !== kb.length) return false;
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return false;
    if (String(a[ka[i]]) !== String(b[ka[i]])) return false;
  }
  return true;
}

async function runSearch(pageToken = "") {
  const obj = formToObject();
  writeHash(obj);
  const params = new URLSearchParams(obj);
  if (pageToken) params.set("pageToken", pageToken);

  statusEl.className = "status";
  statusEl.textContent = "Searching...";
  meta.classList.add("hidden");
  pagination.classList.add("hidden");
  grid.innerHTML = "";

  try {
    const resp = await fetch(`/api/search?${params.toString()}`);
    const data = await resp.json();
    if (!resp.ok) {
      statusEl.className = "status error";
      statusEl.textContent = `Error: ${data.error || resp.statusText}`;
      return;
    }
    statusEl.textContent = "";
    refreshQuota();
    applySearchPayload(data, { fromCache: false });
    cacheSnapshot(obj, pageToken, data);
  } catch (err) {
    statusEl.className = "status error";
    statusEl.textContent = `Network error: ${err.message}`;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  runSearch("");
});
prevBtn.addEventListener("click", () => currentTokens.prev && runSearch(currentTokens.prev));
nextBtn.addEventListener("click", () => currentTokens.next && runSearch(currentTokens.next));
btnRefresh.addEventListener("click", () => {
  const snap = loadSnapshot();
  runSearch(snap?.pageToken || "");
});

// ----- Init -----------------------------------------------------------
(function init() {
  loadPrefs();
  refreshSavedSelect();
  refreshQuota();
  loadCategories(regionInput?.value || "US");

  const fromHash = readHash();
  const snap = loadSnapshot();

  // Prefer a cached snapshot whose params match the URL hash (or when the
  // hash is empty and we just have a cached session). Refresh restores
  // state without hitting the API.
  if (snap && snap.data) {
    const hashMatches = !fromHash
      ? Object.keys(snap.params || {}).length === 0
      : paramsEqual(snap.params || {}, fromHash);
    if (hashMatches) {
      applyObjectToForm(snap.params || {});
      if (snap.params?.regionCode) loadCategories(snap.params.regionCode);
      applySearchPayload(snap.data, { fromCache: true });
      statusEl.textContent = "";
      requestAnimationFrame(() => window.scrollTo(0, snap.scrollY || 0));
      return;
    }
  }

  if (fromHash && Object.keys(fromHash).length) {
    applyObjectToForm(fromHash);
    if (fromHash.regionCode) loadCategories(fromHash.regionCode);
    runSearch("");
  }
})();

// Save scroll position periodically so refresh restores it too.
let scrollSaveTimer = null;
window.addEventListener("scroll", () => {
  clearTimeout(scrollSaveTimer);
  scrollSaveTimer = setTimeout(() => {
    const snap = loadSnapshot();
    if (snap) {
      snap.scrollY = window.scrollY;
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(snap)); } catch {}
    }
  }, 200);
}, { passive: true });
