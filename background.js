// Keeps the toolbar badge and the lifetime "blocked" total up to date
const tabCounts = {};

function setBadge(tabId, count, active, enabled) {
  let text = "";
  if (!enabled) text = "OFF";
  else if (active && count > 0) text = count > 999 ? "999+" : String(count);
  const opts = tabId != null ? { tabId } : {};
  chrome.action.setBadgeText({ ...opts, text });
  chrome.action.setBadgeBackgroundColor({ ...opts, color: enabled ? "#e62832" : "#666" });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== "count" || !sender.tab) return;
  const tabId = sender.tab.id;
  tabCounts[tabId] = msg.count;
  chrome.storage.local.get({ enabled: true, totalBlocked: 0 }, (data) => {
    setBadge(tabId, msg.count, msg.active, data.enabled);
    if (msg.added > 0) chrome.storage.local.set({ totalBlocked: data.totalBlocked + msg.added });
  });
});

chrome.tabs.onRemoved.addListener((tabId) => delete tabCounts[tabId]);

function refreshGlobalBadge() {
  chrome.storage.local.get({ enabled: true }, (data) => setBadge(null, 0, false, data.enabled));
}

chrome.runtime.onInstalled.addListener(refreshGlobalBadge);
chrome.runtime.onStartup.addListener(refreshGlobalBadge);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.enabled) refreshGlobalBadge();
});
