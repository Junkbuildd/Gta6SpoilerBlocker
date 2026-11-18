// GTA Spoiler Filtresi - içerik betiği (prototip v0.2)
(() => {
  "use strict";

  // Her terim, kelimenin başında geçtiğinde eşleşir (Türkçe ekler için: "Rockstar'ın", "GTA'da").
  // \p{L} harf sınıfı Türkçe karakterleri (ç, ğ, ı, ö, ş, ü) da kapsar.
  const TERMS = [
    // GTA ve tam adı (GTA 6, GTA VI, GTA6, GTAVI, Grand Theft Auto ...)
    "(?<!\\p{L})gta",
    "(?<!\\p{L})grand\\s*theft\\s*auto",
    // Firma ve kurucular
    "(?<!\\p{L})rockstar",
    "(?<!\\p{L})take[-\\s]?two",
    "(?<!\\p{L})houser",
    // Oyun dünyası ve karakterleri
    "(?<!\\p{L})liberty\\s*city",
    "(?<!\\p{L})vice\\s*city",
    "(?<!\\p{L})los\\s*santos",
    "(?<!\\p{L})san\\s*andreas",
    "(?<!\\p{L})leonida",
    "(?<!\\p{L})lucia(?!\\p{L})",
    "(?<!\\p{L})jason(?!\\p{L})",
    // Rockstar oyunları
    "(?<!\\p{L})red\\s*dead",
    "(?<!\\p{L})max\\s*payne",
    "(?<!\\p{L})la\\s*noire",
    "(?<!\\p{L})midnight\\s*club",
    "(?<!\\p{L})manhunt",
    "(?<!\\p{L})bully(?!\\p{L})",
    // Sızıntı ve spoiler
    "(?<!\\p{L})s[ıi]z(?:ınt|int|dır|dir|dı|di|an)\\p{L}*",
    "(?<!\\p{L})leak\\p{L}*",
    "(?<!\\p{L})spoiler\\p{L}*",
    "(?<!\\p{L})teaser\\p{L}*",
    // Performans / teknik tartışmalar
    "(?<![\\p{L}\\d])(?:30|60|120)\\s?fps",
    "(?<!\\p{L})frame\\s?rate",
    // Hayal kırıklığı ve beklenti
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
    // "13 yıldır beklenen oyun", "13-year wait" gibi ifadeler
    "(?<!\\p{L})13\\s*[- ]?y[ıiIİ]l\\p{L}*\\s+(?:\\p{L}+\\s+){0,2}?bekl",
    "(?<!\\p{L})13[- ]years?\\s+(?:\\p{L}+\\s+){0,2}?(?:wait|anticipat|in the making)",
    // "en çok beklenen oyun", "most anticipated game", "long-awaited game"
    "(?<!\\p{L})(?:most|en\\s+çok)\\s+(?:anticipated|beklenen)\\s+(?:game|oyun)",
    "(?<!\\p{L})long-?awaited\\s+(?:game|oyun)",
  ];

  const PATTERN = new RegExp(TERMS.join("|"), "iu");
  const MARK = "data-gta-filtre";
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "CODE"]);
  // Bir içeriğin "kart" gibi gizlenebileceği kapsayıcılar
  const CARD_SELECTOR = "article, li, tr, section, [role='article'], [role='listitem']";

  const matches = (s) => typeof s === "string" && s.length > 0 && PATTERN.test(s);

  function hide(el) {
    if (!el || el === document.body || el === document.documentElement) return;
    const target = el.closest(CARD_SELECTOR) || el;
    if (target === document.body || target === document.documentElement) return;
    if (target.hasAttribute(MARK)) return;
    target.style.setProperty("display", "none", "important");
    target.setAttribute(MARK, "1");
  }

  // Dosya adındaki kelimeler için (ör. "gta-6-trailer.jpg"); URL kodlamasını çözer
  function safeDecode(s) {
    if (!s) return s;
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }

  function checkAttributes(el) {
    if (
      matches(el.getAttribute("alt")) ||
      matches(el.getAttribute("title")) ||
      matches(el.getAttribute("aria-label")) ||
      (el.tagName === "A" && matches(el.getAttribute("href"))) ||
      (el.tagName === "IMG" && (matches(safeDecode(el.getAttribute("src"))) || matches(safeDecode(el.getAttribute("srcset")))))
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

  // Dinamik yüklenen içerikler (sonsuz kaydırma, SPA sayfaları) için
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

  function start() {
    scan(document.body);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.body) {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  }
})();
