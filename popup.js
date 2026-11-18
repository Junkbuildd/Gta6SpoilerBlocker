const toggle = document.getElementById("toggle");
const status = document.getElementById("status");

function render(isOn) {
  toggle.checked = isOn;
  status.textContent = isOn ? "Blocking: On" : "Blocking: Off";
}

chrome.storage.local.get({ enabled: true }, (data) => render(data.enabled));

toggle.addEventListener("change", () => {
  chrome.storage.local.set({ enabled: toggle.checked });
  render(toggle.checked);
});
