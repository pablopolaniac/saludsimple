/* ==========================================
   SaludSimple.org — Language Toggle System
   Supports: es (Spanish), en (English), pt (Brazilian Portuguese)
   ========================================== */

(function () {
  var STORAGE_KEY = 'saludsimple_lang';
  var DEFAULT_LANG = 'es';
  var SUPPORTED = { es: true, en: true, pt: true };

  function getSavedLang() {
    try {
      var lang = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
      return SUPPORTED[lang] ? lang : DEFAULT_LANG;
    } catch (e) {
      return DEFAULT_LANG;
    }
  }

  function saveLang(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {}
  }

  function getLangText(el, lang) {
    var text = el.getAttribute('data-' + lang);
    if (text !== null) return text;
    // Fallback while Portuguese is still being filled in
    if (lang === 'pt') {
      return el.getAttribute('data-en') || el.getAttribute('data-es');
    }
    return el.getAttribute('data-es');
  }

  function getLangAlt(el, lang) {
    var text = el.getAttribute('data-' + lang + '-alt');
    if (text !== null) return text;
    if (lang === 'pt') {
      return el.getAttribute('data-en-alt') || el.getAttribute('data-es-alt');
    }
    return el.getAttribute('data-es-alt');
  }

  function setElementText(el, text) {
    if (el.children.length === 0) {
      el.textContent = text;
      return;
    }
    var hasTranslatableChild = el.querySelector('[data-es]');
    if (hasTranslatableChild) {
      return;
    }
    var nodes = el.childNodes;
    var found = false;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].nodeType === 3 && nodes[i].nodeValue.trim() !== '') {
        nodes[i].nodeValue = text + ' ';
        found = true;
        break;
      }
    }
    if (!found) {
      el.insertBefore(document.createTextNode(text + ' '), el.firstChild);
    }
  }

  function applyLanguage(lang) {
    if (!SUPPORTED[lang]) lang = DEFAULT_LANG;
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;

    var elements = document.querySelectorAll('[data-es]');
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var text = getLangText(el, lang);
      if (text !== null) {
        setElementText(el, text);
      }
    }

    var altElements = document.querySelectorAll('[data-es-alt]');
    for (var j = 0; j < altElements.length; j++) {
      var altEl = altElements[j];
      var altText = getLangAlt(altEl, lang);
      if (altText !== null) {
        altEl.alt = altText;
      }
    }

    // Tooltips / titles that use data-es-title / data-en-title / data-pt-title
    var titleElements = document.querySelectorAll('[data-es-title]');
    for (var t = 0; t < titleElements.length; t++) {
      var titleEl = titleElements[t];
      var titleText = titleEl.getAttribute('data-' + lang + '-title');
      if (titleText === null && lang === 'pt') {
        titleText = titleEl.getAttribute('data-en-title') || titleEl.getAttribute('data-es-title');
      }
      if (titleText !== null) {
        titleEl.setAttribute('title', titleText);
      }
    }

    var toggleButtons = document.querySelectorAll('.lang-toggle__btn');
    for (var k = 0; k < toggleButtons.length; k++) {
      var btn = toggleButtons[k];
      if (btn.getAttribute('data-lang') === lang) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }

    try {
      document.dispatchEvent(
        new CustomEvent('saludsimple:langchange', { detail: { lang: lang } })
      );
    } catch (e) {
      /* older browsers */
    }
  }

  function init() {
    var lang = getSavedLang();
    applyLanguage(lang);

    var toggleButtons = document.querySelectorAll('.lang-toggle__btn');
    for (var i = 0; i < toggleButtons.length; i++) {
      toggleButtons[i].addEventListener('click', function () {
        var targetLang = this.getAttribute('data-lang');
        if (targetLang && targetLang !== getSavedLang()) {
          saveLang(targetLang);
          applyLanguage(targetLang);
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
