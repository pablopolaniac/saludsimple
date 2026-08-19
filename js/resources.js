/* ==========================================
   SaludSimple.org — Resource Finder
   Loads live data from the public Google Sheet
   (edit the sheet → refresh the page). Falls
   back to embedded js/resources-data.js offline.
   ========================================== */

(function () {
  var dataCache = null;
  var dataPromise = null;

  // MASTER resource_database — must stay "Anyone with the link can view"
  var SHEET_ID = '1q6_dwNBk-uhuj0-m9iiQvEvHpei-kUOo6hUVl5YzH0k';
  var SHEET_TABS = {
    states: 'States',
    programs: 'Programs',
    resource_types: 'Resource_Types',
    organizations: 'Organizations',
    resources: 'Resources'
  };

  function normalizeKey(key) {
    return String(key || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^\w]/g, '');
  }

  function isTruthy(value) {
    if (value === true || value === 1) return true;
    if (value === false || value === 0 || value == null) return false;
    var s = String(value).trim().toLowerCase();
    return s === 'true' || s === 'yes' || s === '1';
  }

  function cellValue(cell) {
    if (!cell) return null;
    if (cell.v !== undefined && cell.v !== null) return cell.v;
    if (cell.f !== undefined && cell.f !== null) return cell.f;
    return null;
  }

  function parseGvizTable(table) {
    if (!table || !table.cols) return [];
    var rows = table.rows || [];
    var headers = [];
    var labelsEmpty = true;

    for (var c = 0; c < table.cols.length; c++) {
      var col = table.cols[c] || {};
      var label = normalizeKey(col.label || '');
      // Do NOT use col.id (A/B/C) as field names — Google leaves labels empty
      // when the header row is treated as data (parsedNumHeaders: 0).
      if (label) labelsEmpty = false;
      headers.push(label || 'col' + c);
    }

    var start = 0;
    if ((labelsEmpty || table.parsedNumHeaders === 0) && rows.length) {
      var first = rows[0].c || [];
      var maybeHeaders = [];
      var looksLikeHeaderRow = true;
      for (var h = 0; h < first.length; h++) {
        var headerVal = normalizeKey(cellValue(first[h]));
        maybeHeaders.push(headerVal || 'col' + h);
        if (!headerVal || !/[a-z]/.test(headerVal) || headerVal.length > 40) {
          looksLikeHeaderRow = false;
        }
      }
      if (looksLikeHeaderRow || labelsEmpty) {
        headers = maybeHeaders;
        start = 1;
      }
    }

    var out = [];
    for (var r = start; r < rows.length; r++) {
      var cells = (rows[r] && rows[r].c) || [];
      var item = {};
      var empty = true;
      for (var i = 0; i < headers.length; i++) {
        var val = cellValue(cells[i]);
        if (val !== null && String(val).trim() !== '') empty = false;
        item[headers[i]] = val;
      }
      if (!empty) out.push(item);
    }
    return out;
  }

  function loadSheetTab(sheetName) {
    return new Promise(function (resolve, reject) {
      var cbName =
        '_saludSheet_' +
        String(sheetName).replace(/\W/g, '') +
        '_' +
        Math.random().toString(36).slice(2);
      var settled = false;
      var script = document.createElement('script');

      function cleanup() {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          delete window[cbName];
        } catch (e) {
          window[cbName] = undefined;
        }
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      var timer = setTimeout(function () {
        cleanup();
        reject(new Error('Timed out loading sheet: ' + sheetName));
      }, 20000);

      window[cbName] = function (response) {
        cleanup();
        if (!response || response.status !== 'ok' || !response.table) {
          reject(new Error('Sheet query failed: ' + sheetName));
          return;
        }
        resolve(parseGvizTable(response.table));
      };

      script.async = true;
      script.src =
        'https://docs.google.com/spreadsheets/d/' +
        SHEET_ID +
        '/gviz/tq?sheet=' +
        encodeURIComponent(sheetName) +
        '&tqx=responseHandler:' +
        cbName +
        '&_=' +
        Date.now();
      script.onerror = function () {
        cleanup();
        reject(new Error('Could not load sheet script: ' + sheetName));
      };
      document.head.appendChild(script);
    });
  }

  function stringifyId(value) {
    if (value == null || String(value).trim() === '') return null;
    if (typeof value === 'number' && value === Math.floor(value)) return String(value);
    return String(value).trim();
  }

  function normalizeResource(row) {
    var item = {};
    for (var k in row) {
      if (Object.prototype.hasOwnProperty.call(row, k)) item[k] = row[k];
    }
    item.active = isTruthy(item.active);
    item.resource_type_id = stringifyId(item.resource_type_id);
    item.state_id = item.state_id != null ? String(item.state_id).trim().toUpperCase() : null;
    item.program_id =
      item.program_id != null ? String(item.program_id).trim().toUpperCase() : null;
    item.org_id = stringifyId(item.org_id);
    item.resource_id = stringifyId(item.resource_id);
    item.phone = item.phone != null && String(item.phone).trim() !== '' ? String(item.phone).trim() : null;
    item.url = item.url != null && String(item.url).trim() !== '' ? String(item.url).trim() : null;
    ['title', 'description', 'notes', 'language', 'geographic_scope'].forEach(function (key) {
      if (item[key] != null && String(item[key]).trim() !== '') {
        item[key] = String(item[key]).trim();
      } else {
        item[key] = item[key] == null ? null : '';
      }
    });
    return item;
  }

  function normalizeLookup(rows) {
    return (rows || []).map(function (row) {
      var item = {};
      for (var k in row) {
        if (!Object.prototype.hasOwnProperty.call(row, k)) continue;
        var v = row[k];
        if (v == null || String(v).trim() === '') item[k] = null;
        else if (typeof v === 'number' && k.indexOf('_id') !== -1 && v === Math.floor(v)) {
          item[k] = String(v);
        } else item[k] = typeof v === 'string' ? v.trim() : v;
      }
      if (item.state_id) item.state_id = String(item.state_id).toUpperCase();
      if (item.program_id) item.program_id = String(item.program_id).toUpperCase();
      return item;
    });
  }

  function loadFromGoogleSheet() {
    return Promise.all([
      loadSheetTab(SHEET_TABS.states),
      loadSheetTab(SHEET_TABS.programs),
      loadSheetTab(SHEET_TABS.resource_types),
      loadSheetTab(SHEET_TABS.organizations),
      loadSheetTab(SHEET_TABS.resources)
    ]).then(function (parts) {
      var resources = [];
      for (var i = 0; i < parts[4].length; i++) {
        var norm = normalizeResource(parts[4][i]);
        if (norm.active) resources.push(norm);
      }
      return {
        updated: new Date().toISOString(),
        source: 'google_sheet',
        states: normalizeLookup(parts[0]),
        programs: normalizeLookup(parts[1]),
        resource_types: normalizeLookup(parts[2]),
        organizations: normalizeLookup(parts[3]),
        resources: resources
      };
    });
  }

  function loadFallbackData() {
    if (typeof window !== 'undefined' && window.SALUD_RESOURCES) {
      return Promise.resolve(window.SALUD_RESOURCES);
    }
    return Promise.reject(new Error('No embedded resource fallback available'));
  }

  function loadData() {
    if (dataCache) return Promise.resolve(dataCache);
    if (dataPromise) return dataPromise;

    // Prefer live Google Sheet so non-technical editors never run a sync script.
    dataPromise = loadFromGoogleSheet()
      .catch(function (err) {
        console.warn('Live Google Sheet load failed; using fallback data.', err);
        return loadFallbackData();
      })
      .then(function (data) {
        dataCache = data;
        return data;
      });
    return dataPromise;
  }

  function currentLang() {
    try {
      return localStorage.getItem('saludsimple_lang') || 'es';
    } catch (e) {
      return 'es';
    }
  }

  function t(map) {
    var lang = currentLang();
    return map[lang] || map.es || map.en || '';
  }

  function typeLabel(data, typeId) {
    var id = String(typeId);
    var types = data.resource_types || [];
    for (var i = 0; i < types.length; i++) {
      if (String(types[i].resource_type_id) === id) {
        var lang = currentLang();
        if (lang === 'es') return types[i].type_name_es || types[i].type_name_en || id;
        if (lang === 'pt') return types[i].type_name_es || types[i].type_name_en || id;
        return types[i].type_name_en || types[i].type_name_es || id;
      }
    }
    return id;
  }

  function stateNameFromData(data, stateId) {
    var id = String(stateId || '').toUpperCase();
    var states = (data && data.states) || [];
    for (var i = 0; i < states.length; i++) {
      if (String(states[i].state_id).toUpperCase() === id) {
        return states[i].state_name || id;
      }
    }
    return id;
  }

  function programDisplayName(data, programId) {
    var id = String(programId || '').toUpperCase();
    var friendly = {
      AUTISM: { es: 'Autismo', en: 'Autism', pt: 'Autismo' },
      SNAP: { es: 'SNAP', en: 'SNAP', pt: 'SNAP' },
      WIC: { es: 'WIC', en: 'WIC', pt: 'WIC' },
      MEDICAID: { es: 'Medicaid', en: 'Medicaid', pt: 'Medicaid' }
    };
    if (friendly[id]) return t(friendly[id]);

    var programs = (data && data.programs) || [];
    for (var i = 0; i < programs.length; i++) {
      var p = programs[i];
      if (String(p.program_id || '').toUpperCase() !== id) continue;
      var lang = currentLang();
      if (lang === 'es') return p.program_name_es || p.program_name || p.program_name_en || id;
      if (lang === 'pt') {
        return p.program_name_pt || p.program_name_es || p.program_name || p.program_name_en || id;
      }
      return p.program_name_en || p.program_name || p.program_name_es || id;
    }
    return id;
  }

  function groupHeading(typeId, programName) {
    var id = String(typeId);
    var prog = programName || '';
    if (id === '1') {
      return t({
        es: 'Solicitar' + (prog ? ' ' + prog : ''),
        en: 'Apply for' + (prog ? ' ' + prog : ''),
        pt: 'Inscrever-se' + (prog ? ' no ' + prog : '')
      });
    }
    if (id === '2') {
      return t({
        es: 'Ayuda para aplicar',
        en: 'Help applying',
        pt: 'Ajuda para se inscrever'
      });
    }
    return typeLabel(dataCache, id);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isPlaceholderUrl(url) {
    if (!url) return true;
    return /example\.(com|org|net)/i.test(url);
  }

  function displayHostname(url) {
    try {
      var host = new URL(url).hostname.replace(/^www\./i, '');
      return host || url;
    } catch (e) {
      return url;
    }
  }

  function normalizeLangCode(raw) {
    if (!raw) return '';
    var v = String(raw).trim().toLowerCase();
    if (v === 'es' || v === 'spanish' || v === 'español' || v === 'espanol') return 'es';
    if (v === 'en' || v === 'english' || v === 'inglés' || v === 'ingles') return 'en';
    if (v === 'pt' || v === 'portuguese' || v === 'português' || v === 'portugues' || v === 'pt-br') {
      return 'pt';
    }
    return '';
  }

  function languageLabel(raw) {
    var code = normalizeLangCode(raw);
    if (code === 'es') return t({ es: 'Español', en: 'Spanish', pt: 'Espanhol' });
    if (code === 'en') return t({ es: 'Inglés', en: 'English', pt: 'Inglês' });
    if (code === 'pt') return t({ es: 'Portugués', en: 'Portuguese', pt: 'Português' });
    return raw ? String(raw) : '';
  }

  function orgName(data, orgId) {
    if (!orgId || !data || !data.organizations) return '';
    var id = String(orgId);
    for (var i = 0; i < data.organizations.length; i++) {
      if (String(data.organizations[i].org_id) === id) {
        return data.organizations[i].org_name || data.organizations[i].name || '';
      }
    }
    return '';
  }

  var ADMIN_SENTENCE_RE =
    /verify|source provided|before publishing|needs review|imported from|organization not yet|reported as broken|user[- ]provided|official site checked|review notes|pending verification|master document|check back|still accepted/i;

  function cleanPublicText(text) {
    if (!text) return '';
    var parts = String(text)
      .replace(/\s+/g, ' ')
      .trim()
      .split(/[.!?]+\s+/);
    var kept = [];
    for (var i = 0; i < parts.length; i++) {
      var sentence = parts[i].trim();
      if (!sentence) continue;
      if (ADMIN_SENTENCE_RE.test(sentence)) continue;
      kept.push(sentence);
    }
    return kept.join(' ').trim();
  }

  function looksCompatibleWithSiteLang(text, siteLang) {
    if (!text) return false;
    var sample = String(text);
    var hasEs =
      /[áéíóúñ¿¡]/i.test(sample) ||
      /\b(solicitud|beneficios|ayuda|teléfono|oficina|estado|español|descripción|programa)\b/i.test(
        sample
      );
    var hasEn =
      /\b(the|and|apply|application|benefits|help|phone|office|source|verify|broken|provided|online|through)\b/i.test(
        sample
      );
    if (siteLang === 'es') return hasEs || !hasEn;
    if (siteLang === 'en') return hasEn || !hasEs;
    // Portuguese: prefer PT fields; otherwise accept ES-ish public copy over admin English
    return !ADMIN_SENTENCE_RE.test(sample);
  }

  function isLowQualityTitle(title) {
    if (!title) return true;
    var s = String(title).trim();
    if (s.length < 4) return true;
    // Sheet imports sometimes used generic placeholders
    if (/resources?\s+resource$/i.test(s)) return true;
    if (/^autism resources?$/i.test(s)) return true;
    return false;
  }

  function defaultTitleForType(typeId, stateName, programName, resource) {
    var id = String(typeId);
    var prog = programName || '';
    var host =
      resource && resource.url && !isPlaceholderUrl(resource.url)
        ? displayHostname(resource.url)
        : '';

    if (host && (id === '3' || id === '7' || id === '8' || id === '9')) {
      return host;
    }
    if (id === '1') {
      return t({
        es: 'Solicitud' + (prog ? ' de ' + prog : '') + ' en línea',
        en: 'Online' + (prog ? ' ' + prog : '') + ' application',
        pt: 'Inscrição online' + (prog ? ' no ' + prog : '')
      });
    }
    if (id === '2') {
      return t({
        es: 'Ayuda para solicitar' + (prog ? ' ' + prog : ''),
        en: 'Help applying for' + (prog ? ' ' + prog : ''),
        pt: 'Ajuda para se inscrever' + (prog ? ' no ' + prog : '')
      });
    }
    if (id === '4') {
      return t({
        es: 'Buscador de oficinas locales',
        en: 'Local office finder',
        pt: 'Localizador de escritórios'
      });
    }
    if (id === '12') {
      return t({
        es: 'Línea de ayuda / contacto' + (prog ? ' de ' + prog : ''),
        en: (prog ? prog + ' ' : '') + 'help line / contact',
        pt: 'Linha de ajuda / contato' + (prog ? ' do ' + prog : '')
      });
    }
    if (id === '3') {
      return t({
        es: 'Información del programa' + (prog ? ' ' + prog : ''),
        en: (prog ? prog + ' ' : '') + 'program information',
        pt: 'Informações do programa' + (prog ? ' ' + prog : '')
      });
    }
    return groupHeading(id, prog);
  }

  function pickLocalizedField(resource, base) {
    var lang = currentLang();
    var keyed = resource[base + '_' + lang];
    if (keyed) return String(keyed).trim();
    if (lang === 'pt') {
      if (resource[base + '_es']) return String(resource[base + '_es']).trim();
      if (resource[base + '_en']) return String(resource[base + '_en']).trim();
    }
    return '';
  }

  function userFacingTitle(resource, stateName, programName) {
    var localized = pickLocalizedField(resource, 'title');
    if (localized && !isLowQualityTitle(localized)) {
      return cleanPublicText(localized) || localized;
    }

    var siteLang = currentLang();
    var resLang = normalizeLangCode(resource.language);
    var raw = resource.title ? String(resource.title).trim() : '';
    var cleaned = cleanPublicText(raw);

    // Only use sheet title when it matches the site language (or has no lang tag but text fits)
    if (
      cleaned &&
      !isLowQualityTitle(cleaned) &&
      ((resLang && resLang === siteLang) || (!resLang && looksCompatibleWithSiteLang(cleaned, siteLang)))
    ) {
      return cleaned;
    }
    return defaultTitleForType(resource.resource_type_id, stateName, programName, resource);
  }

  function resourceLinkLabel(resource, titleText) {
    if (resource.url && !isPlaceholderUrl(resource.url)) {
      return displayHostname(resource.url) + ' →';
    }
    return (titleText || t({ es: 'Abrir sitio →', en: 'Open site →', pt: 'Abrir site →' })) + ' →';
  }

  function languageMetaHtml(resource) {
    var lang = languageLabel(resource.language);
    if (!lang) return '';
    return (
      '<p class="resource-finder__meta">' +
      '<span class="resource-finder__meta-item">' +
      t({ es: 'Idioma:', en: 'Language:', pt: 'Idioma:' }) +
      ' ' +
      escapeHtml(lang) +
      '</span></p>'
    );
  }

  function splitPhoneNumbers(raw) {
    return String(raw || '')
      .split(/\s*[;|]\s*/)
      .map(function (p) {
        return p.trim();
      })
      .filter(Boolean);
  }

  function phoneDigits(raw) {
    return String(raw || '').replace(/[^\d+]/g, '');
  }

  function phoneChannelFor(resource, display, digits) {
    var url = String(resource.url || '').toLowerCase();
    var last4 = digits.replace(/\D/g, '').slice(-4);
    if (url.indexOf('includenyc.org') !== -1) {
      if (last4 === '4668') {
        return {
          kind: 'call',
          label: t({ es: 'Llamar:', en: 'Call:', pt: 'Ligar:' })
        };
      }
      if (last4 === '3157') {
        return {
          kind: 'sms',
          label: t({ es: 'Texto:', en: 'Text:', pt: 'SMS:' })
        };
      }
      if (last4 === '0795') {
        return {
          kind: 'whatsapp',
          label: t({ es: 'WhatsApp:', en: 'WhatsApp:', pt: 'WhatsApp:' })
        };
      }
    }
    return {
      kind: 'call',
      label: t({ es: 'Teléfono:', en: 'Phone:', pt: 'Telefone:' })
    };
  }

  function phoneHref(kind, digits) {
    var bare = String(digits || '').replace(/[^\d]/g, '');
    if (kind === 'sms') return 'sms:+' + (bare.length === 10 ? '1' + bare : bare);
    if (kind === 'whatsapp') {
      var wa = bare.length === 10 ? '1' + bare : bare;
      return 'https://wa.me/' + wa;
    }
    return 'tel:' + digits;
  }

  function phoneHtml(resource) {
    if (!resource.phone) return '';
    var parts = splitPhoneNumbers(resource.phone);
    if (!parts.length) return '';

    var lines = parts.map(function (part) {
      var digits = phoneDigits(part);
      var channel = phoneChannelFor(resource, part, digits);
      var href = phoneHref(channel.kind, digits);
      var external = channel.kind === 'whatsapp';
      return (
        '<p class="resource-finder__phone">' +
        '<span class="resource-finder__phone-label">' +
        escapeHtml(channel.label) +
        '</span> ' +
        '<a href="' +
        escapeHtml(href) +
        '"' +
        (external ? ' target="_blank" rel="noopener noreferrer"' : '') +
        '>' +
        escapeHtml(part) +
        '</a></p>'
      );
    });

    return '<div class="resource-finder__phones">' + lines.join('') + '</div>';
  }

  function compactHintForUrl(url) {
    if (!url) return '';
    var u = String(url).toLowerCase();
    // California DDS main autism page
    if (u.indexOf('dds.ca.gov') !== -1 && u.indexOf('/initiatives/autism') !== -1) {
      return t({
        es: 'Página principal',
        en: 'Main page',
        pt: 'Página principal'
      });
    }
    // California DDS regional center directory
    if (u.indexOf('dds.ca.gov') !== -1 && u.indexOf('/rc/listings') !== -1) {
      return t({
        es: 'Buscador de centros regionales',
        en: 'Regional center finder',
        pt: 'Localizador de centros regionais'
      });
    }
    return '';
  }

  function renderCompactItem(resource) {
    var url = resource.url;
    var typeId = String(resource.resource_type_id);
    var host =
      url && !isPlaceholderUrl(url)
        ? displayHostname(url)
        : resource.title || t({ es: 'Recurso', en: 'Resource', pt: 'Recurso' });
    var hint = compactHintForUrl(url);

    var linkHtml = '';
    if (url && !isPlaceholderUrl(url)) {
      linkHtml =
        '<a class="resource-finder__link resource-finder__link--primary" href="' +
        escapeHtml(url) +
        '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(host + ' →') +
        '</a>';
    } else if (url && isPlaceholderUrl(url)) {
      linkHtml =
        '<p class="resource-finder__note">' +
        t({
          es: 'Enlace pendiente de verificación.',
          en: 'Link pending verification.',
          pt: 'Link pendente de verificação.'
        }) +
        '</p>';
    } else {
      linkHtml = '<p class="resource-finder__item-title">' + escapeHtml(host) + '</p>';
    }

    var hintHtml = hint
      ? '<p class="resource-finder__item-hint">' + escapeHtml(hint) + '</p>'
      : '';

    return (
      '<article class="resource-finder__item resource-finder__item--compact" data-type="' +
      escapeHtml(typeId) +
      '">' +
      linkHtml +
      hintHtml +
      languageMetaHtml(resource) +
      phoneHtml(resource) +
      '</article>'
    );
  }

  function renderDetailedItem(resource, data, stateId, programId) {
    var stateName = stateNameFromData(data, stateId || resource.state_id);
    var programName = programDisplayName(data, programId || resource.program_id);
    var typeId = String(resource.resource_type_id);
    var headingText = groupHeading(typeId, programName);
    var titleText = userFacingTitle(resource, stateName, programName);
    // Only show sheet-authored descriptions (skip generated filler)
    var descText = '';
    var localizedDesc = pickLocalizedField(resource, 'description');
    var rawDesc = resource.description ? String(resource.description).trim() : '';
    var candidate = cleanPublicText(localizedDesc || rawDesc);
    if (candidate && looksCompatibleWithSiteLang(candidate, currentLang())) {
      descText = candidate;
    }

    var url = resource.url;
    var heading = escapeHtml(headingText);
    var title = escapeHtml(titleText);
    var desc = escapeHtml(descText);
    var organization = escapeHtml(orgName(data, resource.org_id));

    var metaParts = [];
    var langLine = languageMetaHtml(resource);
    if (organization) {
      metaParts.push(
        '<span class="resource-finder__meta-item">' +
          t({ es: 'Organización:', en: 'Organization:', pt: 'Organização:' }) +
          ' ' +
          organization +
          '</span>'
      );
    }

    var linkHtml = '';
    if (url && !isPlaceholderUrl(url)) {
      linkHtml =
        '<a class="resource-finder__link resource-finder__link--primary" href="' +
        escapeHtml(url) +
        '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(resourceLinkLabel(resource, titleText)) +
        '</a>';
    } else if (url && isPlaceholderUrl(url)) {
      linkHtml =
        '<p class="resource-finder__note">' +
        t({
          es: 'Enlace pendiente de verificación.',
          en: 'Link pending verification.',
          pt: 'Link pendente de verificação.'
        }) +
        '</p>';
    }

    // Avoid repeating the hostname as both title and link label
    var showTitle = titleText && !(url && !isPlaceholderUrl(url) && titleText === displayHostname(url));

    return (
      '<article class="resource-finder__item" data-type="' +
      escapeHtml(typeId) +
      '">' +
      (heading ? '<p class="resource-finder__item-label">' + heading + '</p>' : '') +
      (showTitle ? '<h3 class="resource-finder__item-title">' + title + '</h3>' : '') +
      (desc ? '<p class="resource-finder__item-desc">' + desc + '</p>' : '') +
      (metaParts.length
        ? '<p class="resource-finder__meta">' +
          metaParts.join('<span class="resource-finder__meta-sep" aria-hidden="true">·</span>') +
          '</p>'
        : '') +
      phoneHtml(resource) +
      linkHtml +
      langLine +
      '</article>'
    );
  }

  function renderResourceItem(resource, data, stateId, programId, displayMode) {
    if (displayMode === 'compact') {
      return renderCompactItem(resource);
    }
    return renderDetailedItem(resource, data, stateId, programId);
  }

  function filterResources(data, programId, stateId, typeIds) {
    var program = String(programId || '').toUpperCase();
    var state = String(stateId || '').toUpperCase();
    var types = (typeIds || []).map(String);
    var results = [];

    for (var i = 0; i < data.resources.length; i++) {
      var r = data.resources[i];
      if (String(r.program_id || '').toUpperCase() !== program) continue;
      // Only exact state matches — do not pull Nationwide (NW) rows
      if (String(r.state_id || '').toUpperCase() !== state) continue;
      if (types.length && types.indexOf(String(r.resource_type_id)) === -1) continue;
      results.push(r);
    }

    // Keep caller type order when possible
    var typeOrder = {};
    for (var t = 0; t < types.length; t++) typeOrder[types[t]] = t;

    results.sort(function (a, b) {
      var aType = String(a.resource_type_id);
      var bType = String(b.resource_type_id);
      var aIdx = typeOrder.hasOwnProperty(aType) ? typeOrder[aType] : 99;
      var bIdx = typeOrder.hasOwnProperty(bType) ? typeOrder[bType] : 99;
      if (aIdx !== bIdx) return aIdx - bIdx;
      return aType.localeCompare(bType);
    });

    return results;
  }

  function fallbackResources(data, programId, stateId) {
    // If preferred types are empty for this state, show any SNAP resources for that state
    return filterResources(data, programId, stateId, []);
  }

  function populateSelect(select, states) {
    var placeholder = select.querySelector('option[disabled]');
    select.innerHTML = '';
    if (placeholder) {
      select.appendChild(placeholder);
    } else {
      var opt = document.createElement('option');
      opt.disabled = true;
      opt.selected = true;
      opt.textContent = t({
        es: 'Seleccione su estado',
        en: 'Select your state',
        pt: 'Selecione seu estado'
      });
      select.appendChild(opt);
    }

    var sorted = states.slice().sort(function (a, b) {
      return String(a.state_name).localeCompare(String(b.state_name));
    });

    for (var i = 0; i < sorted.length; i++) {
      var s = sorted[i];
      var id = s.state_id || s.stateid;
      var name = s.state_name || s.statename || s.name;
      if (!id || !name) continue;
      if (String(id).toUpperCase() === 'NW') continue;
      // Skip accidental header rows if parser ever includes them
      if (String(id).toLowerCase() === 'state_id') continue;
      var option = document.createElement('option');
      option.value = String(id).toUpperCase();
      option.textContent = String(name);
      select.appendChild(option);
    }
  }

  function openResultsPanel(container) {
    container.hidden = false;
    // Force reflow so the open transition runs after content is set
    void container.offsetHeight;
    container.classList.add('is-open');
  }

  var PAGE_SIZE = 3;

  function paginationHtml(page, totalPages) {
    if (totalPages <= 1) return '';

    var buttons = [];
    for (var i = 1; i <= totalPages; i++) {
      buttons.push(
        '<button type="button" class="resource-finder__page-btn' +
          (i === page ? ' is-active' : '') +
          '" data-page="' +
          i +
          '" aria-label="' +
          escapeHtml(
            t({
              es: 'Página ' + i,
              en: 'Page ' + i,
              pt: 'Página ' + i
            })
          ) +
          '"' +
          (i === page ? ' aria-current="page"' : '') +
          '>' +
          i +
          '</button>'
      );
    }

    return (
      '<nav class="resource-finder__pagination" aria-label="' +
      escapeHtml(
        t({
          es: 'Páginas de recursos',
          en: 'Resource pages',
          pt: 'Páginas de recursos'
        })
      ) +
      '">' +
      '<span class="resource-finder__pagination-label">' +
      escapeHtml(
        t({
          es: 'Página ' + page + ' de ' + totalPages,
          en: 'Page ' + page + ' of ' + totalPages,
          pt: 'Página ' + page + ' de ' + totalPages
        })
      ) +
      '</span>' +
      '<div class="resource-finder__pagination-btns">' +
      buttons.join('') +
      '</div></nav>'
    );
  }

  function renderResults(container, resources, data, stateId, programId, displayMode, page) {
    var wasOpen = container.classList.contains('is-open');
    container.classList.remove('is-open');
    var programName = programDisplayName(data, programId);
    var programNameEsc = escapeHtml(programName);
    var mode = displayMode || 'detailed';
    var currentPage = Math.max(1, page || 1);
    var totalPages = Math.max(1, Math.ceil(resources.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    container._rfResources = resources;
    container._rfData = data;
    container._rfStateId = stateId;
    container._rfProgramId = programId;
    container._rfDisplayMode = mode;
    container._rfPage = currentPage;

    var body;
    if (!resources.length) {
      body =
        '<p class="resource-finder__empty">' +
        t({
          es:
            'No encontramos recursos de ' +
            programNameEsc +
            ' para este estado todavía. Intente otro estado o vuelva pronto.',
          en:
            'We do not have ' +
            programNameEsc +
            ' resources for this state yet. Try another state or check back soon.',
          pt:
            'Ainda não encontramos recursos de ' +
            programNameEsc +
            ' para este estado. Tente outro estado ou volte em breve.'
        }) +
        '</p>';
    } else {
      var stateName = escapeHtml(stateNameFromData(data, stateId));
      var start = (currentPage - 1) * PAGE_SIZE;
      var pageItems = resources.slice(start, start + PAGE_SIZE);
      body =
        '<div class="resource-finder__panel">' +
        '<p class="resource-finder__panel-heading">' +
        t({
          es: 'Recursos de ' + programNameEsc + ' en ' + stateName,
          en: programNameEsc + ' resources in ' + stateName,
          pt: 'Recursos de ' + programNameEsc + ' em ' + stateName
        }) +
        '</p>' +
        pageItems
          .map(function (r) {
            return renderResourceItem(r, data, stateId, programId, mode);
          })
          .join('') +
        paginationHtml(currentPage, totalPages) +
        '</div>';
    }

    container.innerHTML = '<div class="resource-finder__results-inner">' + body + '</div>';

    if (wasOpen) {
      // Brief close → open so the slide restarts when switching states
      requestAnimationFrame(function () {
        openResultsPanel(container);
      });
    } else {
      openResultsPanel(container);
    }
  }

  function initFinder(el, data) {
    var program = el.getAttribute('data-program') || 'SNAP';
    var typesAttr = el.getAttribute('data-types') || '1,2';
    var displayMode = el.getAttribute('data-display') || 'detailed';
    var preferredTypes = typesAttr.split(',').map(function (x) {
      return x.trim();
    }).filter(Boolean);

    var select = el.querySelector('.resource-finder__select');
    var results = el.querySelector('.resource-finder__results');
    if (!select || !results) return;

    populateSelect(select, data.states || []);

    function showForState(stateId, scroll, page) {
      if (!stateId) return;
      var matched = filterResources(data, program, stateId, preferredTypes);
      if (!matched.length) {
        matched = fallbackResources(data, program, stateId);
      }
      renderResults(results, matched, data, stateId, program, displayMode, page || 1);
      if (scroll) {
        results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    select.addEventListener('change', function () {
      showForState(select.value, true, 1);
    });

    results.addEventListener('click', function (e) {
      var btn = e.target.closest('.resource-finder__page-btn');
      if (!btn || !results.contains(btn)) return;
      var nextPage = parseInt(btn.getAttribute('data-page'), 10);
      if (!nextPage || nextPage === results._rfPage) return;
      renderResults(
        results,
        results._rfResources || [],
        results._rfData || data,
        results._rfStateId || select.value,
        results._rfProgramId || program,
        results._rfDisplayMode || displayMode,
        nextPage
      );
      results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    document.addEventListener('saludsimple:langchange', function () {
      if (select.value) showForState(select.value, false, results._rfPage || 1);
    });
  }

  function setFinderLoading(finders, loading) {
    for (var i = 0; i < finders.length; i++) {
      var select = finders[i].querySelector('.resource-finder__select');
      var results = finders[i].querySelector('.resource-finder__results');
      if (select) select.disabled = !!loading;
      if (!results) continue;
      if (loading) {
        results.hidden = false;
        results.classList.add('is-open');
        results.innerHTML =
          '<div class="resource-finder__results-inner"><p class="resource-finder__empty">' +
          t({
            es: 'Cargando recursos actualizados…',
            en: 'Loading latest resources…',
            pt: 'Carregando recursos atualizados…'
          }) +
          '</p></div>';
      }
    }
  }

  function init() {
    var finders = document.querySelectorAll('.resource-finder');
    if (!finders.length) return;

    setFinderLoading(finders, true);

    loadData()
      .then(function (data) {
        setFinderLoading(finders, false);
        for (var i = 0; i < finders.length; i++) {
          var results = finders[i].querySelector('.resource-finder__results');
          if (results) {
            results.classList.remove('is-open');
            results.hidden = true;
            results.innerHTML = '';
          }
          initFinder(finders[i], data);
        }
      })
      .catch(function (err) {
        console.error(err);
        for (var j = 0; j < finders.length; j++) {
          var select = finders[j].querySelector('.resource-finder__select');
          if (select) select.disabled = false;
          var results = finders[j].querySelector('.resource-finder__results');
          if (results) {
            results.hidden = false;
            results.classList.add('is-open');
            results.innerHTML =
              '<div class="resource-finder__results-inner"><p class="resource-finder__empty">' +
              t({
                es: 'No se pudieron cargar los recursos. Intente de nuevo más tarde.',
                en: 'Resources could not be loaded. Please try again later.',
                pt: 'Não foi possível carregar os recursos. Tente novamente mais tarde.'
              }) +
              '</p></div>';
          }
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
