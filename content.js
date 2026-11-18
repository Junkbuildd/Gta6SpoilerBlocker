// GTA 6 Spoiler Blocker - content script
(() => {
  "use strict";

  // Each term matches at the start of a word, so suffixed forms are caught too
  // (e.g. "GTA's", "GTAV", "GTAVI", "GTA6"). \p{L} covers all Unicode letters.
  const TERMS = [
    // Game title (GTA, GTA 5, GTA V, GTA 6, GTA VI, GTA6, GTAV, GTAVI, Grand Theft Auto)
    "(?<!\\p{L})gta",
    "(?<!\\p{L})grand\\s*theft\\s*auto",
    // Publisher, studio and founders
    "(?<!\\p{L})rockstar",
    "(?<!\\p{L})take[-\\s]?two",
    "(?<!\\p{L})houser",
    // In-game world and characters
    "(?<!\\p{L})liberty\\s*city",
    "(?<!\\p{L})vice\\s*city",
    "(?<!\\p{L})los\\s*santos",
    "(?<!\\p{L})san\\s*andreas",
    "(?<!\\p{L})leonida",
    "(?<!\\p{L})lucia(?!\\p{L})",
    "(?<!\\p{L})jason(?!\\p{L})",
    // Other games by the same studio
    "(?<!\\p{L})red\\s*dead",
    "(?<!\\p{L})max\\s*payne",
    "(?<!\\p{L})la\\s*noire",
    "(?<!\\p{L})midnight\\s*club",
    "(?<!\\p{L})manhunt",
    "(?<!\\p{L})bully(?!\\p{L})",
    // Leaks and spoilers
    "(?<!\\p{L})s[ıi]z(?:ınt|int|dır|dir|dı|di|an)\\p{L}*",
    "(?<!\\p{L})leak\\p{L}*",
    "(?<!\\p{L})spoiler\\p{L}*",
    "(?<!\\p{L})teaser\\p{L}*",
    // Performance / technical discussion
    "(?<![\\p{L}\\d])(?:30|60|120)\\s?fps",
    "(?<!\\p{L})frame\\s?rate",
    // Disappointment and expectations
    "(?<!\\p{L})beklenen\\s+olmad",
    "(?<!\\p{L})beklentiler\\p{L}*\\s+kar[sş][ıiI]lamad",
    "(?<!\\p{L})beklentinin\\s+alt[ıiI]nda",
    "(?<!\\p{L})beklentiyi\\s+kar[sş][ıiI]lamad",
    "(?<!\\p{L})hayal\\s+k[ıiI]r[ıiI]kl[ıiI][ğg]",
    "(?<!\\p{L})y[ıiI]llard[ıiI]r\\s+beklenen",
    "(?<!\\p{L})wait\\s+is\\s+over",
    "(?<!\\p{L})underwhelm\\p{L}*",
    "(?<!\\p{L})disappoint\\p{L}*",
    "(?<!\\p{L})let\\s+down",
    // Long wait phrases (Turkish and English)
    "(?<!\\p{L})13\\s*[- ]?y[ıiIİ]l\\p{L}*\\s+(?:\\p{L}+\\s+){0,2}?bekl",
    "(?<!\\p{L})13[- ]years?\\s+(?:\\p{L}+\\s+){0,2}?(?:wait|anticipat|in the making)",
    // "most anticipated game", "long-awaited game"
    "(?<!\\p{L})(?:most|en\\s+çok)\\s+(?:anticipated|beklenen)\\s+(?:game|oyun)",
    "(?<!\\p{L})long-?awaited\\s+(?:game|oyun)",
  ];

  const BUILTIN = TERMS.join("|");
  let PATTERN = new RegExp(BUILTIN, "iu");

  const escapeRegExp = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Add the user's own filter words to the built-in list
  function buildPattern(customTerms) {
    const extra = (customTerms || [])
      .map((t) => String(t).trim())
      .filter(Boolean)
      .map((t) => "(?<!\\p{L})" + escapeRegExp(t).replace(/\s+/g, "\\s*"));
    PATTERN = new RegExp([BUILTIN, ...extra].join("|"), "iu");
  }
  const MARK = "data-spoiler-blocked";
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "CODE"]);
  // Containers that usually hold one whole item (news card, post, list entry)
  const CARD_SELECTOR = "article, li, tr, section, [role='article'], [role='listitem']";
  const MEDIA_SELECTOR = "img, picture, video, figure, [style*='background-image']";
  // How far up the tree to look for a headline's thumbnail
  const MAX_CLIMB = 6;
  const MAX_CARD_TEXT = 500;

  const matches = (s) => typeof s === "string" && s.length > 0 && PATTERN.test(s);
  const HOST = location.hostname.replace(/^www\./, "");

  function safeDecode(s) {
    if (!s) return s;
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }

  // Find the element to hide: a known card container, or the smallest
  // ancestor that also contains the headline's image/video.
  function findContainer(el) {
    const card = el.closest(CARD_SELECTOR);
    if (card && card !== document.body) return card;

    let node = el;
    for (let i = 0; i < MAX_CLIMB; i++) {
      const parent = node.parentElement;
      if (!parent || parent === document.body || parent === document.documentElement) break;
      if ((parent.textContent || "").length > MAX_CARD_TEXT) break;
      node = parent;
      if (node.matches(MEDIA_SELECTOR) || node.querySelector(MEDIA_SELECTOR)) return node;
    }
    return el;
  }

  function hide(el) {
    if (!el || el === document.body || el === document.documentElement) return;
    const target = findContainer(el);
    if (target === document.body || target === document.documentElement) return;
    if (target.hasAttribute(MARK)) return;
    // Remember the original inline display value so it can be restored
    target.setAttribute(MARK, target.style.getPropertyValue("display") || "");
    target.style.setProperty("display", "none", "important");
    // Count each item only once, even if settings change and it is hidden again
    if (!everBlocked.has(target)) {
      everBlocked.add(target);
      newlyBlocked++;
    }
    scheduleReport();
  }

  function checkAttributes(el) {
    if (
      matches(el.getAttribute("alt")) ||
      matches(el.getAttribute("title")) ||
      matches(el.getAttribute("aria-label")) ||
      (el.tagName === "A" && matches(safeDecode(el.getAttribute("href")))) ||
      (el.tagName === "IMG" &&
        (matches(safeDecode(el.getAttribute("src"))) || matches(safeDecode(el.getAttribute("srcset")))))
    ) {
      hide(el);
    }
  }

  function scan(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE || SKIP_TAGS.has(root.tagName)) return;

    checkAttributes(root);
    root.querySelectorAll("img, a, [title], [aria-label]").forEach(checkAttributes);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return matches(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });

    const hits = [];
    while (walker.nextNode()) hits.push(walker.currentNode);
    hits.forEach((node) => hide(node.parentElement));
  }

  // Handle content loaded later (infinite scroll, single-page apps)
  const queue = new Set();
  let scheduled = false;

  function flush() {
    scheduled = false;
    for (const el of queue) {
      if (el.isConnected) scan(el);
    }
    queue.clear();
  }

  function enqueue(el) {
    if (el && el.nodeType === Node.ELEMENT_NODE) queue.add(el);
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(flush);
    }
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "childList") {
        m.addedNodes.forEach(enqueue);
      } else if (m.type === "characterData" && m.target.parentElement) {
        enqueue(m.target.parentElement);
      }
    }
  });

  let enabled = false;
  let newlyBlocked = 0;
  const everBlocked = new WeakSet();
  let reportTimer = null;

  const blockedCount = () => document.querySelectorAll(`[${MARK}]`).length;

  // Tell the background worker how many items are hidden (for the badge and total)
  function report() {
    reportTimer = null;
    const added = newlyBlocked;
    newlyBlocked = 0;
    try {
      chrome.runtime.sendMessage({ type: "count", count: blockedCount(), added, active: enabled });
    } catch (e) {
      // Extension was reloaded; this page's script is orphaned
    }
  }

  function scheduleReport() {
    if (!reportTimer) reportTimer = setTimeout(report, 300);
  }

  function enable() {
    if (enabled || !document.body) return;
    enabled = true;
    scan(document.body);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    scheduleReport();
  }

  function disable() {
    if (!enabled) return;
    enabled = false;
    observer.disconnect();
    queue.clear();
    document.querySelectorAll(`[${MARK}]`).forEach((el) => {
      const original = el.getAttribute(MARK);
      el.style.removeProperty("display");
      if (original) el.style.setProperty("display", original);
      el.removeAttribute(MARK);
    });
    newlyBlocked = 0;
    scheduleReport();
  }

  function isAllowedSite(allowedSites) {
    return (allowedSites || []).some((site) => HOST === site || HOST.endsWith("." + site));
  }

  const DEFAULTS = { enabled: true, allowedSites: [], customTerms: [] };

  // Re-read settings and re-apply from scratch (handles removed filters too)
  function applySettings() {
    chrome.storage.local.get(DEFAULTS, (data) => {
      buildPattern(data.customTerms);
      disable();
      if (data.enabled && !isAllowedSite(data.allowedSites)) enable();
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.enabled || changes.allowedSites || changes.customTerms) applySettings();
  });

  // The popup asks this page for its status
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "getStatus") {
      sendResponse({ host: HOST, count: blockedCount(), active: enabled });
    }
  });

  if (document.body) {
    applySettings();
  } else {
    document.addEventListener("DOMContentLoaded", applySettings, { once: true });
  }
})();
