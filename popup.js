const $ = (id) => document.getElementById(id);
const DEFAULTS = { enabled: true, allowedSites: [], customTerms: [], totalBlocked: 0 };

let settings = { ...DEFAULTS };
let currentHost = null;
let activeTabId = null;

function renderList(listEl, items, onRemove, emptyText) {
  listEl.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = emptyText;
    listEl.appendChild(li);
    return;
  }
  items.forEach((item) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = item;
    span.title = item;
    const btn = document.createElement("button");
    btn.className = "x";
    btn.textContent = "×";
    btn.title = "Remove";
    btn.addEventListener("click", () => onRemove(item));
    li.append(span, btn);
    listEl.appendChild(li);
  });
}

function render() {
  $("toggle").checked = settings.enabled;
  $("status").textContent = settings.enabled ? "Blocking: On" : "Blocking: Off";
  $("totalCount").textContent = settings.totalBlocked.toLocaleString();

  const allowed = currentHost && settings.allowedSites.includes(currentHost);
  $("siteBtn").disabled = !currentHost;
  $("siteBtn").textContent = allowed ? "Block on this site again" : "Allow on this site";

  renderList($("filterList"), settings.customTerms, (t) =>
    save({ customTerms: settings.customTerms.filter((x) => x !== t) }), "No custom filters yet");
  renderList($("siteList"), settings.allowedSites, (s) =>
    save({ allowedSites: settings.allowedSites.filter((x) => x !== s) }), "No allowed sites");
}

function save(patch) {
  Object.assign(settings, patch);
  chrome.storage.local.set(patch);
  render();
  setTimeout(refreshPageCount, 500);
}

function refreshPageCount() {
  if (activeTabId == null) return;
  chrome.tabs.sendMessage(activeTabId, { type: "getStatus" }, (res) => {
    if (chrome.runtime.lastError || !res) {
      $("pageCount").textContent = "–";
      return;
    }
    currentHost = res.host;
    $("host").textContent = res.host;
    $("pageCount").textContent = res.count;
    render();
  });
}

$("toggle").addEventListener("change", () => save({ enabled: $("toggle").checked }));

$("siteBtn").addEventListener("click", () => {
  if (!currentHost) return;
  const list = settings.allowedSites.includes(currentHost)
    ? settings.allowedSites.filter((s) => s !== currentHost)
    : [...settings.allowedSites, currentHost];
  save({ allowedSites: list });
});

$("filterForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const word = $("filterInput").value.trim();
  if (!word) return;
  const exists = settings.customTerms.some((t) => t.toLowerCase() === word.toLowerCase());
  if (!exists) save({ customTerms: [...settings.customTerms, word] });
  $("filterInput").value = "";
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.totalBlocked) {
    settings.totalBlocked = changes.totalBlocked.newValue;
    $("totalCount").textContent = settings.totalBlocked.toLocaleString();
  }
});

chrome.storage.local.get(DEFAULTS, (data) => {
  settings = data;
  render();
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length) return;
    activeTabId = tabs[0].id;
    $("host").textContent = "Not available on this page";
    refreshPageCount();
  });
});
