/* ==========================================
   SaludSimple.org — Site search (FAB + autocomplete)
   ========================================== */

(function () {
  var LANG_KEY = 'saludsimple_lang';
  var MAX_RESULTS = 5;
  var MIN_QUERY = 2;

  var STOPWORDS = {
    a: 1, al: 1, an: 1, and: 1, are: 1, as: 1, at: 1,
    can: 1, como: 1, com: 1, con: 1,
    da: 1, das: 1, de: 1, del: 1, do: 1, does: 1, dos: 1,
    e: 1, el: 1, en: 1, es: 1, for: 1, from: 1,
    help: 1, how: 1,
    i: 1, in: 1, is: 1,
    la: 1, las: 1, le: 1, los: 1,
    me: 1, mi: 1, mis: 1, my: 1,
    no: 1, not: 1, nao: 1, 'não': 1, nos: 1,
    o: 1, of: 1, on: 1, or: 1, ou: 1,
    para: 1, por: 1, preciso: 1, puedo: 1,
    que: 1, 'qué': 1,
    se: 1, su: 1, sus: 1,
    the: 1, to: 1,
    um: 1, uma: 1, un: 1, una: 1, unos: 1, unas: 1,
    what: 1, when: 1, where: 1, with: 1, y: 1, your: 1
  };

  var COPY = {
    es: {
      open: 'Buscar',
      close: 'Cerrar búsqueda',
      label: '¿Qué está buscando?',
      placeholder: 'Ej. medicaid, medicinas, vivienda…',
      empty: 'No se encontraron resultados',
      hint: 'Escriba para ver sugerencias'
    },
    en: {
      open: 'Search',
      close: 'Close search',
      label: 'What are you looking for?',
      placeholder: 'E.g. medicaid, medicine, housing…',
      empty: 'No results found',
      hint: 'Type to see suggestions'
    },
    pt: {
      open: 'Buscar',
      close: 'Fechar busca',
      label: 'O que você está procurando?',
      placeholder: 'Ex.: medicaid, remédios, moradia…',
      empty: 'Nenhum resultado encontrado',
      hint: 'Digite para ver sugestões'
    }
  };

  var root = null;
  var panel = null;
  var input = null;
  var resultsEl = null;
  var labelEl = null;
  var openBtn = null;
  var closeBtn = null;
  var basePath = '';
  var activeIndex = -1;

  function getLang() {
    try {
      var lang = localStorage.getItem(LANG_KEY) || 'es';
      return COPY[lang] ? lang : 'es';
    } catch (e) {
      return 'es';
    }
  }

  function t() {
    return COPY[getLang()];
  }

  function normalize(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(query) {
    var parts = normalize(query).split(' ');
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var w = parts[i];
      if (!w || w.length < 2) continue;
      if (STOPWORDS[w]) continue;
      out.push(w);
    }
    return out;
  }

  function wordMatches(word, token) {
    if (!word || !token) return false;
    if (word === token) return 'exact';
    if (word.indexOf(token) === 0 && token.length >= 2) return 'prefix';
    if (token.length >= 4 && word.indexOf(token) !== -1) return 'contains';
    if (token.length >= 3 && word.length >= 3 && token.indexOf(word) === 0) return 'rev';
    return false;
  }

  function bestFieldMatch(fieldNorm, token) {
    var words = fieldNorm.split(' ');
    var best = 0;
    for (var i = 0; i < words.length; i++) {
      var kind = wordMatches(words[i], token);
      if (kind === 'exact') best = Math.max(best, 3);
      else if (kind === 'prefix') best = Math.max(best, 2);
      else if (kind === 'contains' || kind === 'rev') best = Math.max(best, 1);
    }
    if (fieldNorm.indexOf(token) !== -1 && best === 0 && token.length >= 3) {
      best = 1;
    }
    return best;
  }

  function buildFields(entry) {
    return {
      title: normalize([entry.titleEs, entry.titleEn, entry.titlePt].join(' ')),
      category: normalize([entry.categoryEs, entry.categoryEn, entry.categoryPt].join(' ')),
      summary: normalize([entry.summaryEs, entry.summaryEn, entry.summaryPt].join(' ')),
      keywords: normalize((entry.keywords || []).join(' '))
    };
  }

  function scoreEntry(entry, queryNorm, tokens, fields) {
    if (!fields) fields = buildFields(entry);
    var score = 0;
    var matched = 0;
    var strongHits = 0;

    if (queryNorm.length >= 3) {
      if (fields.title.indexOf(queryNorm) !== -1) score += 120;
      if (fields.keywords.indexOf(queryNorm) !== -1) score += 100;
      if (fields.summary.indexOf(queryNorm) !== -1) score += 40;
    }

    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      var titleHit = bestFieldMatch(fields.title, tok);
      var kwHit = bestFieldMatch(fields.keywords, tok);
      var catHit = bestFieldMatch(fields.category, tok);
      var sumHit = bestFieldMatch(fields.summary, tok);

      // Short prefixes: only title/keywords, avoid weak summary hits like "medical…"
      if (tok.length <= 3) {
        catHit = 0;
        sumHit = 0;
      }

      var best = Math.max(titleHit, kwHit, catHit, sumHit);
      if (!best) continue;
      matched++;

      if (tok.length <= 3) {
        if (kwHit >= 2) score += 55;
        else if (kwHit === 1) score += 20;
        if (titleHit >= 2) score += 28;
        else if (titleHit === 1) score += 10;
        if (kwHit >= 2 || titleHit >= 2) strongHits++;
        continue;
      }

      if (titleHit === 3) score += 45;
      else if (titleHit === 2) score += 32;
      else if (titleHit === 1) score += 16;

      if (kwHit === 3) score += 38;
      else if (kwHit === 2) score += 26;
      else if (kwHit === 1) score += 14;

      if (catHit) score += 8 + catHit * 2;
      if (sumHit && !titleHit && !kwHit) score += 6 + sumHit * 2;

      if (titleHit >= 2 || kwHit >= 2) strongHits++;
    }

    if (matched === 0) return 0;

    // Avoid weak single common-ish hits when query has multiple intent words
    if (tokens.length >= 2) {
      var needed = Math.ceil(tokens.length * 0.5);
      if (matched < needed && strongHits === 0 && score < 50) return 0;
    }

    // Single short token must be a solid title/keyword hit
    if (tokens.length === 1 && tokens[0].length <= 3 && strongHits === 0 && score < 30) {
      return 0;
    }

    if (matched >= 2) score += matched * 18;
    if (strongHits >= 2) score += 25;

    return score;
  }

  function search(query) {
    var index = window.__SITE_SEARCH_INDEX__ || [];
    var queryNorm = normalize(query);
    if (queryNorm.length < MIN_QUERY) return [];

    var tokens = tokenize(query);
    // If everything was stopwords but query is long enough, try raw words
    if (!tokens.length) {
      tokens = queryNorm.split(' ').filter(function (w) { return w.length >= 3; });
    }
    if (!tokens.length && queryNorm.length < 3) return [];

    var scored = [];
    for (var i = 0; i < index.length; i++) {
      var entry = index[i];
      var fields = buildFields(entry);
      var s = scoreEntry(entry, queryNorm, tokens.length ? tokens : [queryNorm], fields);
      if (s > 0) {
        scored.push({ entry: entry, score: s });
      }
    }

    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.entry.titleEs.length - b.entry.titleEs.length;
    });

    return scored.slice(0, MAX_RESULTS);
  }

  function resolveUrl(url) {
    if (!url) return '#';
    if (/^https?:/i.test(url)) return url;
    var base = basePath.replace(/\/$/, '');
    return base + '/' + url.replace(/^\//, '');
  }

  function titleFor(entry) {
    var lang = getLang();
    if (lang === 'en') return entry.titleEn || entry.titleEs;
    if (lang === 'pt') return entry.titlePt || entry.titleEn || entry.titleEs;
    return entry.titleEs;
  }

  function categoryFor(entry) {
    var lang = getLang();
    if (lang === 'en') return entry.categoryEn || entry.categoryEs || '';
    if (lang === 'pt') return entry.categoryPt || entry.categoryEn || entry.categoryEs || '';
    return entry.categoryEs || '';
  }

  function applyCopy() {
    var c = t();
    if (openBtn) openBtn.setAttribute('aria-label', c.open);
    if (closeBtn) closeBtn.setAttribute('aria-label', c.close);
    if (labelEl) labelEl.textContent = c.label;
    if (input) {
      input.setAttribute('placeholder', c.placeholder);
      input.setAttribute('aria-label', c.label);
    }
    if (root && root.classList.contains('is-open') && input && !input.value.trim()) {
      renderHint();
    } else if (input && input.value.trim()) {
      renderResults(search(input.value));
    }
  }

  function renderHint() {
    resultsEl.innerHTML =
      '<p class="site-search__hint">' + escapeHtml(t().hint) + '</p>';
    activeIndex = -1;
  }

  function renderResults(items) {
    var q = input.value.trim();
    if (normalize(q).length < MIN_QUERY) {
      renderHint();
      return;
    }

    if (!items.length) {
      resultsEl.innerHTML =
        '<p class="site-search__empty" role="status">' + escapeHtml(t().empty) + '</p>';
      activeIndex = -1;
      return;
    }

    var html = '<ul class="site-search__list" role="listbox">';
    for (var i = 0; i < items.length; i++) {
      var entry = items[i].entry;
      var cat = categoryFor(entry);
      html +=
        '<li role="option">' +
        '<a class="site-search__result" href="' + escapeAttr(resolveUrl(entry.url)) + '" data-index="' + i + '">' +
        '<span class="site-search__result-title">' + escapeHtml(titleFor(entry)) + '</span>' +
        (cat ? '<span class="site-search__result-cat">' + escapeHtml(cat) + '</span>' : '') +
        '</a></li>';
    }
    html += '</ul>';
    resultsEl.innerHTML = html;
    activeIndex = -1;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
  }

  function openSearch() {
    root.classList.add('is-open');
    openBtn.setAttribute('aria-expanded', 'true');
    panel.setAttribute('aria-hidden', 'false');
    applyCopy();
    if (!input.value.trim()) renderHint();
    setTimeout(function () { input.focus(); }, 30);
  }

  function closeSearch() {
    root.classList.remove('is-open');
    openBtn.setAttribute('aria-expanded', 'false');
    panel.setAttribute('aria-hidden', 'true');
    activeIndex = -1;
    openBtn.focus();
  }

  function toggleSearch() {
    if (root.classList.contains('is-open')) closeSearch();
    else openSearch();
  }

  function onInput() {
    var q = input.value;
    if (normalize(q).length < MIN_QUERY) {
      renderHint();
      return;
    }
    renderResults(search(q));
  }

  function moveActive(delta) {
    var links = resultsEl.querySelectorAll('.site-search__result');
    if (!links.length) return;
    activeIndex += delta;
    if (activeIndex < 0) activeIndex = links.length - 1;
    if (activeIndex >= links.length) activeIndex = 0;
    for (var i = 0; i < links.length; i++) {
      links[i].classList.toggle('is-active', i === activeIndex);
    }
    links[activeIndex].focus();
  }

  function buildUI() {
    root = document.createElement('div');
    root.className = 'site-search';
    root.innerHTML =
      '<button type="button" class="site-search__fab" aria-expanded="false" aria-controls="site-search-panel">' +
      '<svg class="site-search__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.25"/>' +
      '<path d="M15.5 15.5L20 20" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>' +
      '</svg>' +
      '</button>' +
      '<div class="site-search__panel" id="site-search-panel" role="dialog" aria-modal="false" aria-hidden="true">' +
      '<div class="site-search__header">' +
      '<label class="site-search__label" for="site-search-input"></label>' +
      '<button type="button" class="site-search__close" aria-label="Close">&times;</button>' +
      '</div>' +
      '<input id="site-search-input" class="site-search__input" type="search" autocomplete="off" enterkeyhint="search" />' +
      '<div class="site-search__results" id="site-search-results"></div>' +
      '</div>';

    document.body.appendChild(root);
    openBtn = root.querySelector('.site-search__fab');
    closeBtn = root.querySelector('.site-search__close');
    panel = root.querySelector('.site-search__panel');
    input = root.querySelector('.site-search__input');
    resultsEl = root.querySelector('.site-search__results');
    labelEl = root.querySelector('.site-search__label');

    openBtn.addEventListener('click', toggleSearch);
    closeBtn.addEventListener('click', closeSearch);
    input.addEventListener('input', onInput);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSearch();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveActive(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveActive(-1);
      } else if (e.key === 'Enter') {
        var active = resultsEl.querySelector('.site-search__result.is-active');
        var first = resultsEl.querySelector('.site-search__result');
        var target = active || first;
        if (target) {
          e.preventDefault();
          window.location.href = target.getAttribute('href');
        }
      }
    });

    document.addEventListener('click', function (e) {
      if (!root.classList.contains('is-open')) return;
      if (!root.contains(e.target)) closeSearch();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('is-open')) {
        closeSearch();
      }
    });

    document.addEventListener('saludsimple:langchange', applyCopy);
    applyCopy();
  }

  function ensureCss(href) {
    if (document.querySelector('link[data-site-search-css]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-site-search-css', '1');
    document.head.appendChild(link);
  }

  function init(base) {
    basePath = base || '';
    ensureCss(basePath + '/css/search.css');
    if (document.querySelector('.site-search')) return;
    buildUI();
  }

  window.__SITE_SEARCH_INIT__ = init;
})();
