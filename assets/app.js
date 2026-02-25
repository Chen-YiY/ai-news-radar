const state = {
  itemsAi: [],
  itemsAll: [],
  itemsAllRaw: [],
  statsAi: [],
  totalAi: 0,
  totalRaw: 0,
  totalAllMode: 0,
  allDedup: true,
  siteFilter: "",
  query: "",
  mode: "ai",
  waytoagiMode: "today",
  waytoagiData: null,
  generatedAt: null,
  meta: null,
  loaded: false,
};

const statsEl = document.getElementById("stats");
const siteSelectEl = document.getElementById("siteSelect");
const sitePillsEl = document.getElementById("sitePills");
const newsListEl = document.getElementById("newsList");
const updatedAtEl = document.getElementById("updatedAt");
const searchInputEl = document.getElementById("searchInput");
const resultCountEl = document.getElementById("resultCount");
const itemTpl = document.getElementById("itemTpl");
const modeAiBtnEl = document.getElementById("modeAiBtn");
const modeAllBtnEl = document.getElementById("modeAllBtn");
const modeHintEl = document.getElementById("modeHint");
const allDedupeWrapEl = document.getElementById("allDedupeWrap");
const allDedupeToggleEl = document.getElementById("allDedupeToggle");
const allDedupeLabelEl = document.getElementById("allDedupeLabel");

const waytoagiUpdatedAtEl = document.getElementById("waytoagiUpdatedAt");
const waytoagiMetaEl = document.getElementById("waytoagiMeta");
const waytoagiListEl = document.getElementById("waytoagiList");
const waytoagiTodayBtnEl = document.getElementById("waytoagiTodayBtn");
const waytoagi7dBtnEl = document.getElementById("waytoagi7dBtn");

function fmtNumber(n) {
  return new Intl.NumberFormat("zh-CN").format(n || 0);
}

function fmtTime(iso) {
  if (!iso) return "\u65f6\u95f4\u672a\u77e5";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "\u65f6\u95f4\u672a\u77e5";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function fmtDate(iso) {
  if (!iso) return "\u672a\u77e5\u65e5\u671f";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function setStats(payload) {
  const cards = [
    ["24h AI", fmtNumber(payload.total_items)],
    ["24h \u5168\u91cf", fmtNumber(payload.total_items_raw || payload.total_items)],
    ["\u5168\u91cf\u53bb\u91cd\u540e", fmtNumber(payload.total_items_all_mode || payload.total_items_raw || payload.total_items)],
    ["\u7ad9\u70b9\u6570", fmtNumber(payload.site_count)],
    ["\u6e90\u6570\u91cf", fmtNumber(payload.source_count)],
    ["\u5f52\u6863\u603b\u6570", fmtNumber(payload.archive_total || 0)]
  ];

  statsEl.innerHTML = "";
  cards.forEach(([k, v]) => {
    const node = document.createElement("div");
    node.className = "stat";
    node.innerHTML = `<div class="k">${k}</div><div class="v">${v}</div>`;
    statsEl.appendChild(node);
  });
}

function computeSiteStats(items) {
  const m = new Map();
  items.forEach((item) => {
    if (!m.has(item.site_id)) {
      m.set(item.site_id, { site_id: item.site_id, site_name: item.site_name, count: 0, raw_count: 0 });
    }
    const row = m.get(item.site_id);
    row.count += 1;
    row.raw_count += 1;
  });
  return Array.from(m.values()).sort((a, b) => b.count - a.count || a.site_name.localeCompare(b.site_name, "zh-CN"));
}

function currentSiteStats() {
  if (state.mode === "ai") return state.statsAi || [];
  return computeSiteStats(state.allDedup ? (state.itemsAll || []) : (state.itemsAllRaw || []));
}

function renderSiteFilters() {
  const stats = currentSiteStats();

  siteSelectEl.innerHTML = '<option value="">\u5168\u90e8\u7ad9\u70b9</option>';
  stats.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.site_id;
    const raw = s.raw_count ?? s.count;
    opt.textContent = `${s.site_name} (${s.count}/${raw})`;
    siteSelectEl.appendChild(opt);
  });
  siteSelectEl.value = state.siteFilter;

  sitePillsEl.innerHTML = "";
  const allPill = document.createElement("button");
  allPill.className = `pill ${state.siteFilter === "" ? "active" : ""}`;
  allPill.textContent = "\u5168\u90e8";
  allPill.onclick = () => {
    state.siteFilter = "";
    renderSiteFilters();
    renderList();
  };
  sitePillsEl.appendChild(allPill);

  stats.forEach((s) => {
    const btn = document.createElement("button");
    btn.className = `pill ${state.siteFilter === s.site_id ? "active" : ""}`;
    const raw = s.raw_count ?? s.count;
    btn.textContent = `${s.site_name} ${s.count}/${raw}`;
    btn.onclick = () => {
      state.siteFilter = s.site_id;
      renderSiteFilters();
      renderList();
    };
    sitePillsEl.appendChild(btn);
  });
}

function renderModeSwitch() {
  modeAiBtnEl.classList.toggle("active", state.mode === "ai");
  modeAllBtnEl.classList.toggle("active", state.mode === "all");
  if (allDedupeWrapEl) allDedupeWrapEl.classList.toggle("show", state.mode === "all");
  if (allDedupeToggleEl) allDedupeToggleEl.checked = state.allDedup;
  if (allDedupeLabelEl) allDedupeLabelEl.textContent = state.allDedup ? "\u53bb\u91cd\u5f00" : "\u53bb\u91cd\u5173";
  if (state.mode === "ai") {
    modeHintEl.textContent = `\u5f53\u524d\u89c6\u56fe\uff1aAI\u5f3a\u76f8\u5173\uff0c${fmtNumber(state.totalAi)} \u6761\uff09`;
  } else {
    const allCount = state.allDedup
      ? (state.totalAllMode || state.itemsAll.length)
      : (state.totalRaw || state.itemsAllRaw.length);
    modeHintEl.textContent = `\u5f53\u524d\u89c6\u56fe\uff1a\u5168\u91cf\uff08${state.allDedup ? "\u53bb\u91cd\u5f00" : "\u53bb\u91cd\u5173"}\uff09${fmtNumber(allCount)} \u6761\uff09`;
  }
}

function effectiveAllItems() {
  return state.allDedup ? state.itemsAll : state.itemsAllRaw;
}

function modeItems() {
  return state.mode === "all" ? effectiveAllItems() : state.itemsAi;
}

function getFilteredItems() {
  const q = state.query.trim().toLowerCase();
  return modeItems().filter((item) => {
    if (state.siteFilter && item.site_id !== state.siteFilter) return false;
    if (!q) return true;
    const hay = `${item.title || ""} ${item.title_zh || ""} ${item.title_en || ""} ${item.site_name || ""} ${item.source || ""}`.toLowerCase();
    return hay.includes(q);
  });
}

function renderItemNode(item) {
  const node = itemTpl.content.firstElementChild.cloneNode(true);
  node.querySelector(".site").textContent = item.site_name;
  node.querySelector(".source").textContent = `\u6765\u6e90: ${item.source}`;
  node.querySelector(".time").textContent = fmtTime(item.published_at || item.first_seen_at);

  const titleEl = node.querySelector(".title");
  const zh = (item.title_zh || "").trim();
  const en = (item.title_en || "").trim();
  titleEl.textContent = "";
  if (zh && en && zh !== en) {
    const primary = document.createElement("span");
    primary.textContent = zh;
    const sub = document.createElement("span");
    sub.className = "title-sub";
    sub.textContent = en;
    titleEl.appendChild(primary);
    titleEl.appendChild(sub);
  } else {
    titleEl.textContent = item.title || zh || en;
  }
  titleEl.href = item.url;
  return node;
}

function buildSourceGroupNode(source, items) {
  const section = document.createElement("section");
  section.className = "source-group";
  section.innerHTML = `
    <header class="source-group-head">
      <h3>${source}</h3>
      <span>${fmtNumber(items.length)} \u6761</span>
    </header>
    <div class="source-group-list"></div>
  `;
  const listEl = section.querySelector(".source-group-list");
  items.forEach((item) => listEl.appendChild(renderItemNode(item)));
  return section;
}

function groupBySource(items) {
  const groupMap = new Map();
  items.forEach((item) => {
    const key = item.source || "\u672a\u77e5\u6e90";
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key).push(item);
  });

  return Array.from(groupMap.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "zh-CN"));
}

function renderGroupedBySource(items) {
  const groups = groupBySource(items);
  const frag = document.createDocumentFragment();

  groups.forEach(([source, groupItems]) => {
    frag.appendChild(buildSourceGroupNode(source, groupItems));
  });

  newsListEl.appendChild(frag);
}

function renderGroupedBySiteAndSource(items) {
  const siteMap = new Map();
  items.forEach((item) => {
    if (!siteMap.has(item.site_id)) {
      siteMap.set(item.site_id, {
        siteName: item.site_name || item.site_id,
        items: [],
      });
    }
    siteMap.get(item.site_id).items.push(item);
  });

  const sites = Array.from(siteMap.entries()).sort((a, b) => {
    const byCount = b[1].items.length - a[1].items.length;
    if (byCount !== 0) return byCount;
    return a[1].siteName.localeCompare(b[1].siteName, "zh-CN");
  });

  const frag = document.createDocumentFragment();
  sites.forEach(([, site]) => {
    const siteSection = document.createElement("section");
    siteSection.className = "site-group";
    siteSection.innerHTML = `
      <header class="site-group-head">
        <h3>${site.siteName}</h3>
        <span>${fmtNumber(site.items.length)} \u6761</span>
      </header>
      <div class="site-group-list"></div>
    `;

    const siteListEl = siteSection.querySelector(".site-group-list");
    const sourceGroups = groupBySource(site.items);
    sourceGroups.forEach(([source, groupItems]) => {
      siteListEl.appendChild(buildSourceGroupNode(source, groupItems));
    });
    frag.appendChild(siteSection);
  });

  newsListEl.appendChild(frag);
}

function renderList() {
  const filtered = getFilteredItems();
  resultCountEl.textContent = `${fmtNumber(filtered.length)} \u6761`;

  newsListEl.innerHTML = "";

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "\u5f53\u524d\u7b5b\u9009\u6761\u4ef6\u4e0b\u6ca1\u6709\u7ed3\u679c\uff01";
    newsListEl.appendChild(empty);
    return;
  }

  if (state.siteFilter) {
    renderGroupedBySource(filtered);
    return;
  }

  renderGroupedBySiteAndSource(filtered);
}

function waytoagiViews(waytoagi) {
  const updates7d = Array.isArray(waytoagi?.updates_7d) ? waytoagi.updates_7d : [];
  const latestDate = waytoagi?.latest_date || (updates7d.length ? updates7d[0].date : null);
  const updatesToday = Array.isArray(waytoagi?.updates_today) && waytoagi.updates_today.length
    ? waytoagi.updates_today
    : (latestDate ? updates7d.filter((u) => u.date === latestDate) : []);
  return { updates7d, updatesToday, latestDate };
}

function renderWaytoagi(waytoagi) {
  const { updates7d, updatesToday, latestDate } = waytoagiViews(waytoagi);
  if (waytoagiTodayBtnEl) waytoagiTodayBtnEl.classList.toggle("active", state.waytoagiMode === "today");
  if (waytoagi7dBtnEl) waytoagi7dBtnEl.classList.toggle("active", state.waytoagiMode === "7d");
  waytoagiUpdatedAtEl.textContent = `\u66f4\u65b0\u65f6\u95f4\uff1a${fmtTime(waytoagi.generated_at)}`;

  waytoagiMetaEl.innerHTML = `
    <a href="${waytoagi.root_url || "#"}" target="_blank" rel="noopener noreferrer">\u4e3b\u9875\u2197</a>
    <span>\u00b7</span>
    <a href="${waytoagi.history_url || "#"}" target="_blank" rel="noopener noreferrer">\u5386\u53f2\u66f4\u65b0\u9875</a>
    <span>\u00b7</span>
    <span>\u4eca\u5929(${latestDate || "--"})\uff1a${fmtNumber(waytoagi.count_today || updatesToday.length)} \u6761</span>
    <span>\u00b7</span>
    <span>\u8fd1 7 \u5929\uff1a${fmtNumber(waytoagi.count_7d || updates7d.length)} \u6761</span>
  `;

  waytoagiListEl.innerHTML = "";
  if (waytoagi.has_error) {
    const div = document.createElement("div");
    div.className = "waytoagi-error";
    div.textContent = waytoagi.error || "WaytoAGI \u6570\u636e\u52a0\u8f7d\u5931\u8d25";
    waytoagiListEl.appendChild(div);
    return;
  }

  const updates = state.waytoagiMode === "today" ? updatesToday : updates7d;
  if (!updates.length) {
    const div = document.createElement("div");
    div.className = "waytoagi-empty";
    div.textContent = state.waytoagiMode === "today"
      ? "\u4eca\u5929\u6ca1\u6709\u66f4\u65b0\uff0c\u8bf7\u5c1d\u8bd5\u5207\u6362\u5230\u8fd17\u5929\u67e5\u770b\uff01"
      : (waytoagi.warning || "\u8fd1 7 \u5929\u6ca1\u6709\u66f4\u65b0");
    waytoagiListEl.appendChild(div);
    return;
  }

  updates.forEach((u) => {
    const row = document.createElement("a");
    row.className = "waytoagi-item";
    row.href = u.url || "#";
    row.target = "_blank";
    row.rel = "noopener noreferrer";
    row.innerHTML = `<span class="d">${fmtDate(u.date)}</span><span class="t">${u.title}</span>`;
    waytoagiListEl.appendChild(row);
  });
}

// --- Paginated loading ---
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

async function loadAllPages(prefix, total) {
  const all = [];
  const fetches = [];
  for (let i = 0; i < total; i++) {
    fetches.push(fetchJSON(`./data/pages/${prefix}-${i}.json`).then(d => { all[i] = d.items; }));
  }
  await Promise.all(fetches);
  return all.flat();
}

async function init() {
  // Load meta + first AI page + waytoagi in parallel
  const [metaResult, firstPageResult, waytoagiResult] = await Promise.allSettled([
    fetchJSON('./data/latest-24h-meta.json'),
    fetchJSON('./data/pages/ai-0.json'),
    fetchJSON('./data/waytoagi-7d.json'),
  ]);

  if (metaResult.status === "fulfilled") {
    const meta = metaResult.value;
    state.meta = meta;
    state.statsAi = meta.site_stats || [];
    state.totalAi = meta.total_items || 0;
    state.totalRaw = meta.total_items_raw || 0;
    state.totalAllMode = meta.total_items_all_mode || 0;
    state.generatedAt = meta.generated_at;

    setStats(meta);
    updatedAtEl.textContent = `\u66f4\u65b0\u65f6\u95f4\uff1a${fmtTime(state.generatedAt)}`;

    // Render first page immediately
    if (firstPageResult.status === "fulfilled") {
      state.itemsAi = firstPageResult.value.items || [];
      renderModeSwitch();
      renderSiteFilters();
      renderList();
    }

    // Background: load all remaining pages
    const bgLoads = [];
    if (meta.total_pages_ai > 1) {
      const remaining = [];
      for (let i = 1; i < meta.total_pages_ai; i++) {
        remaining.push(fetchJSON(`./data/pages/ai-${i}.json`).then(d => d.items));
      }
      bgLoads.push(Promise.all(remaining).then(pages => {
        state.itemsAi = state.itemsAi.concat(pages.flat());
      }));
    }
    bgLoads.push(loadAllPages("all", meta.total_pages_all || 0).then(items => { state.itemsAll = items; }));
    bgLoads.push(loadAllPages("allraw", meta.total_pages_allraw || 0).then(items => { state.itemsAllRaw = items; }));

    Promise.all(bgLoads).then(() => {
      state.loaded = true;
      renderModeSwitch();
      renderSiteFilters();
      renderList();
    }).catch(() => {});
  } else {
    updatedAtEl.textContent = "\u6570\u636e\u52a0\u8f7d\u5931\u8d25";
    newsListEl.innerHTML = `<div class="empty">${metaResult.reason.message}</div>`;
  }

  if (waytoagiResult.status === "fulfilled") {
    state.waytoagiData = waytoagiResult.value;
    renderWaytoagi(state.waytoagiData);
  } else {
    waytoagiUpdatedAtEl.textContent = "\u52a0\u8f7d\u5931\u8d25";
    waytoagiListEl.innerHTML = `<div class="waytoagi-error">${waytoagiResult.reason.message}</div>`;
  }
}

let _searchTimer;
searchInputEl.addEventListener("input", (e) => {
  state.query = e.target.value;
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => renderList(), 200);
});

siteSelectEl.addEventListener("change", (e) => {
  state.siteFilter = e.target.value;
  renderSiteFilters();
  renderList();
});

modeAiBtnEl.addEventListener("click", () => {
  state.mode = "ai";
  renderModeSwitch();
  renderSiteFilters();
  renderList();
});

modeAllBtnEl.addEventListener("click", () => {
  state.mode = "all";
  renderModeSwitch();
  renderSiteFilters();
  renderList();
});

if (allDedupeToggleEl) {
  allDedupeToggleEl.addEventListener("change", (e) => {
    state.allDedup = Boolean(e.target.checked);
    renderModeSwitch();
    renderSiteFilters();
    renderList();
  });
}

if (waytoagiTodayBtnEl) {
  waytoagiTodayBtnEl.addEventListener("click", () => {
    state.waytoagiMode = "today";
    if (state.waytoagiData) renderWaytoagi(state.waytoagiData);
  });
}

if (waytoagi7dBtnEl) {
  waytoagi7dBtnEl.addEventListener("click", () => {
    state.waytoagiMode = "7d";
    if (state.waytoagiData) renderWaytoagi(state.waytoagiData);
  });
}

init();
