// Shows an "OFF" badge on the toolbar icon while blocking is turned off
function updateBadge(isOn) {
  chrome.action.setBadgeText({ text: isOn ? "" : "OFF" });
  chrome.action.setBadgeBackgroundColor({ color: "#666" });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({ enabled: true }, (data) => updateBadge(data.enabled));
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get({ enabled: true }, (data) => updateBadge(data.enabled));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.enabled) updateBadge(changes.enabled.newValue);
});
