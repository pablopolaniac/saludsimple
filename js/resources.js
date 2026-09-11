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
    // Prefer formatted text when present — gviz nulls multi-value numeric cells like "8,9"
    if (cell.f !== undefined && cell.f !== null && String(cell.f).trim() !== '') {
      return cell.f;
    }
    if (cell.v !== undefined && cell.v !== null) return cell.v;
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
    item.active = item.active == null || String(item.active).trim() === '' ? true : isTruthy(item.active);
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

  function mergeWithFallback(live) {
    var fallback = typeof window !== 'undefined' ? window.SALUD_RESOURCES : null;
    if (!live || !fallback || !fallback.resources || !fallback.resources.length) return live;

    var byId = {};
    for (var i = 0; i < fallback.resources.length; i++) {
      var fr = fallback.resources[i];
      if (fr && fr.resource_id != null) byId[String(fr.resource_id)] = fr;
    }

    var liveIds = {};
    for (var j = 0; j < (live.resources || []).length; j++) {
      var r = live.resources[j];
      if (!r) continue;
      var id = r.resource_id != null ? String(r.resource_id) : '';
      if (id) liveIds[id] = true;
      var fb = id ? byId[id] : null;
      if (!fb) continue;
      // Restore fields gviz often drops (multi-value type ids, etc.)
      if (!r.resource_type_id && fb.resource_type_id) r.resource_type_id = fb.resource_type_id;
      if (!r.phone && fb.phone) r.phone = fb.phone;
      if (!r.url && fb.url) r.url = fb.url;
      if (!r.title && fb.title) r.title = fb.title;
      if ((!r.state_id || r.state_id === 'NULL') && fb.state_id) r.state_id = fb.state_id;
    }

    // Add any fallback resources missing from the live payload
    for (var k = 0; k < fallback.resources.length; k++) {
      var extra = fallback.resources[k];
      if (!extra || extra.resource_id == null) continue;
      var eid = String(extra.resource_id);
      if (liveIds[eid]) continue;
      if (extra.active === false) continue;
      live.resources.push(extra);
      liveIds[eid] = true;
    }

    live.source = (live.source || 'google_sheet') + '+fallback_merge';
    return live;
  }

  function loadData() {
    if (dataCache) return Promise.resolve(dataCache);
    if (dataPromise) return dataPromise;

    // Prefer live Google Sheet so non-technical editors never run a sync script.
    // Merge with embedded fallback so multi-value type cells (e.g. "8,9") are not lost.
    dataPromise = loadFromGoogleSheet()
      .then(function (live) {
        return mergeWithFallback(live);
      })
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
      ASTHMA: { es: 'Asma', en: 'Asthma', pt: 'Asma' },
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
    if (id === '7') return '';
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
    if (/\bautism resources?\s+resource\b/i.test(s)) return true;
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

  function splitPhoneNumbers(raw) {
    return extractPhoneNumbers(raw);
  }

  function isHelpline8008(value) {
    var dig = String(value || '').replace(/[^\d]/g, '');
    if (!dig) return false;
    return dig.slice(-4) === '8008';
  }

  function extractPhoneNumbers(raw) {
    var text = String(raw || '');
    text = text.replace(/\bMail\s+\S+@\S+/gi, ' ');
    text = text.replace(/\bfirst\s+then\b/gi, ' ');
    text = text.replace(/\bCall\b/gi, ' ');
    text = text.replace(/\bor\b/gi, ' ');

    var matches = text.match(/(?:\+?1[\s.-]*)?(?:\(?\d{3}\)?[\s.-]*)\d{3}[\s.-]*\d{4}/g) || [];
    var seen = {};
    var phones = [];
    for (var i = 0; i < matches.length; i++) {
      var part = matches[i].trim();
      var dig = part.replace(/[^\d]/g, '');
      if (dig.length < 10) continue;
      var key = dig.slice(-10);
      if (seen[key]) continue;
      seen[key] = true;
      phones.push(part);
    }

    var local = [];
    var helpline = [];
    for (var j = 0; j < phones.length; j++) {
      if (isHelpline8008(phones[j])) helpline.push(phones[j]);
      else local.push(phones[j]);
    }
    return local.concat(helpline);
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

  function phoneOrdinalLabel(index) {
    if (index <= 0) {
      return t({ es: 'Teléfono:', en: 'Phone:', pt: 'Telefone:' });
    }
    if (index === 1) {
      return t({ es: 'Teléfono 2:', en: 'Phone 2:', pt: 'Telefone 2:' });
    }
    if (index === 2) {
      return t({ es: 'Teléfono 3:', en: 'Phone 3:', pt: 'Telefone 3:' });
    }
    return t({
      es: 'Teléfono ' + (index + 1) + ':',
      en: 'Phone ' + (index + 1) + ':',
      pt: 'Telefone ' + (index + 1) + ':'
    });
  }

  function phoneHtml(resource) {
    if (!resource.phone) return '';
    var parts = extractPhoneNumbers(resource.phone);
    if (!parts.length) return '';

    var localCount = 0;
    for (var c = 0; c < parts.length; c++) {
      if (!isHelpline8008(parts[c])) localCount += 1;
    }

    var localIndex = 0;
    var lines = parts.map(function (part) {
      var digits = phoneDigits(part);
      var helpline = isHelpline8008(part);
      var channel = phoneChannelFor(resource, part, digits);
      var href = phoneHref(channel.kind, digits);
      var external = channel.kind === 'whatsapp';
      var label = helpline
        ? t({ es: 'Teléfono:', en: 'Phone:', pt: 'Telefone:' })
        : phoneOrdinalLabel(localIndex++);
      // Prefer clean display for extracted numbers
      var display = part;
      return (
        '<p class="resource-finder__phone">' +
        '<span class="resource-finder__phone-label">' +
        escapeHtml(label) +
        '</span> ' +
        '<a href="' +
        escapeHtml(href) +
        '"' +
        (external ? ' target="_blank" rel="noopener noreferrer"' : '') +
        '>' +
        escapeHtml(display) +
        '</a></p>'
      );
    });

    var note = '';
    if (localCount > 0 && /8008/.test(String(resource.phone))) {
      note =
        '<p class="resource-finder__item-hint lang-hide-en">' +
        t({
          es:
            'Si el número indicado no lo conecta, llame al 1-866-748-8008. Esa línea sí puede conectarlo con alguien en español.',
          en:
            'If the listed number does not connect you, call 1-866-748-8008. That line can connect you with someone in Spanish.',
          pt:
            'Se o número indicado não conectar, ligue para 1-866-748-8008. Essa linha pode conectá-lo com alguém em espanhol.'
        }) +
        '</p>';
    }

    return '<div class="resource-finder__phones">' + lines.join('') + note + '</div>';
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

  /* Sheet notes are often English-only; map known language-tip patterns to site language */
  function localizeAutismNote(rawNote) {
    if (!rawNote) return '';
    var note = String(rawNote).replace(/\s+/g, ' ').trim();
    if (!note) return '';
    var lower = note.toLowerCase();

    if (/world\s+icon|icono\s+del?\s+mundo|ícone\s+do\s+mundo/i.test(lower)) {
      return t({
        es: 'Puede cambiar el idioma en la esquina superior derecha (ícono del mundo).',
        en: 'Change the language in the top right corner with the world icon.',
        pt: 'Você pode mudar o idioma no canto superior direito (ícone do mundo).'
      });
    }
    if (/upper\s+right|top\s+right|esquina\s+superior|parte\s+superior\s+derecha|canto\s+superior\s+direito/i.test(lower)) {
      return t({
        es: 'Puede cambiar el idioma en la esquina superior derecha.',
        en: 'Change language in the upper right corner.',
        pt: 'Você pode mudar o idioma no canto superior direito.'
      });
    }
    if (/bottom\s+right|inferior\s+y\s+a\s+la\s+derecha|parte\s+inferior.*derecha|canto\s+inferior\s+direito/i.test(lower)) {
      return t({
        es: 'Puede cambiar el idioma en la parte inferior derecha.',
        en: 'Change language at the bottom right.',
        pt: 'Você pode mudar o idioma na parte inferior direita.'
      });
    }
    if (/bottom\s+left|inferior\s+izquierd|canto\s+inferior\s+esquerdo/i.test(lower)) {
      return t({
        es: 'Puede cambiar el idioma en la parte inferior izquierda.',
        en: 'Change language at the bottom left.',
        pt: 'Você pode mudar o idioma na parte inferior esquerda.'
      });
    }
    if (/at\s+the\s+top\b(?!.*right)(?!.*left)|parte\s+de\s+arriba|no\s+topo\s+da/i.test(lower)) {
      return t({
        es: 'Puede cambiar el idioma en la parte de arriba de la página.',
        en: 'Change language at the top of the page.',
        pt: 'Você pode mudar o idioma na parte de cima da página.'
      });
    }
    if (/at\s+the\s+bottom|parte\s+abajo|parte\s+inferior|na\s+parte\s+de\s+baixo|no\s+rodapé/i.test(lower)) {
      return t({
        es: 'Puede cambiar el idioma en la parte de abajo de la página.',
        en: 'Change language at the bottom of the page.',
        pt: 'Você pode mudar o idioma na parte de baixo da página.'
      });
    }
    if (/select\s+language|click.*languages/i.test(lower) && !/upper|top|bottom|left|right/i.test(lower)) {
      return t({
        es: 'Puede cambiar el idioma haciendo clic en la opción de idioma.',
        en: 'Change language by clicking the language option.',
        pt: 'Você pode mudar o idioma clicando na opção de idioma.'
      });
    }
    if (/vale\s+la\s+pena\s+llamar|solo\s+estan\s+en\s+ingles|only\s+in\s+english|só\s+em\s+inglês/i.test(lower)) {
      return t({
        es: 'Recursos ubicados en Minnesota: vale la pena llamar aunque algunos sitios solo estén en inglés.',
        en: 'Resources located in Minnesota — worth calling even if some sites are only in English.',
        pt: 'Recursos localizados em Minnesota — vale a pena ligar mesmo que alguns sites estejam só em inglês.'
      });
    }

    // Unknown note: only show if it already matches the active site language
    var cleaned = cleanPublicText(note);
    if (cleaned && looksCompatibleWithSiteLang(cleaned, currentLang())) return cleaned;
    return '';
  }

  function epilepsyDisplayTitle(resource, viewingStateId) {
    var title = String(resource.title || '').trim();
    if (!title) return '';
    var state = String(viewingStateId || '').toUpperCase();
    var sharedNames = {
      CO: 'Colorado',
      WY: 'Wyoming',
      KS: 'Kansas',
      MO: 'Missouri',
      ME: 'Maine',
      MA: 'Massachusetts',
      NH: 'New Hampshire',
      RI: 'Rhode Island',
      VT: 'Vermont'
    };
    var ids = resourceStateIds(resource);

    if (
      ids.length > 1 &&
      sharedNames[state] &&
      ids.indexOf(state) !== -1 &&
      /colorado|wyoming|kansas|missouri|maine|massachuset|hampshire|rhode|vermont|new\s+england/i.test(
        title
      )
    ) {
      return 'Epilepsy Foundation of ' + sharedNames[state];
    }

    if (/^epilepsy foundation$/i.test(title)) return title;
    if (/epilepsy\s+(alliance|support|society|advocacy|services)\b/i.test(title)) return title;
    if (/valley\s+children/i.test(title)) {
      return title.replace(/\s*\(California\)\s*/i, '').trim();
    }
    if (/young\s+adults/i.test(title)) {
      return t({
        es: 'Young Adults with Epilepsy (Jóvenes adultos con epilepsia)',
        en: 'Young Adults with Epilepsy',
        pt: 'Young Adults with Epilepsy (Jovens adultos com epilepsia)'
      });
    }
    if (/josh\s+provides|exploring\s+epilepsy/i.test(title)) return title;

    var ofMatch = title.match(/^Epilepsy\s+of\s+(.+)$/i);
    if (ofMatch) return 'Epilepsy Foundation of ' + ofMatch[1];

    var plain = title.match(/^Epilepsy\s+(.+)$/i);
    if (plain && !/^foundation\b/i.test(plain[1])) {
      return 'Epilepsy Foundation of ' + plain[1];
    }
    return title;
  }

  function displayTitleForResource(resource, viewingStateId) {
    var prog = String(resource.program_id || '').toUpperCase();
    if (prog === 'EPILEPSY') {
      var epi = epilepsyDisplayTitle(resource, viewingStateId);
      if (epi) return epi;
    }

    var rawTitle = resource.title ? String(resource.title).trim() : '';
    if (rawTitle && !isLowQualityTitle(rawTitle)) return rawTitle;

    // Autism/SNAP compact cards: prefer hostname when sheet title is a placeholder
    if (resource.url && !isPlaceholderUrl(resource.url)) {
      return displayHostname(resource.url);
    }
    if (rawTitle) return rawTitle;
    return t({ es: 'Recurso', en: 'Resource', pt: 'Recurso' });
  }

  function renderCompactItem(resource, stateId, programId) {
    var url = resource.url;
    var typeId = String(resource.resource_type_id);
    var prog = String(programId || resource.program_id || '').toUpperCase();
    var isAutismFinder = prog.indexOf('AUTISM') !== -1;
    var isAsthmaFinder = prog.indexOf('ASTHMA') !== -1;
    var showTitleAsLink = isAutismFinder || isAsthmaFinder;

    var label;
    if (showTitleAsLink) {
      var rawTitle = resource.title ? String(resource.title).trim() : '';
      label =
        rawTitle && !isLowQualityTitle(rawTitle)
          ? rawTitle
          : displayTitleForResource(resource, stateId);
    } else {
      label = displayTitleForResource(resource, stateId);
    }

    var hint = showTitleAsLink ? '' : compactHintForUrl(url);

    var linkHtml = '';
    if (url && !isPlaceholderUrl(url)) {
      linkHtml =
        '<a class="resource-finder__link resource-finder__link--primary" href="' +
        escapeHtml(url) +
        '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(label) +
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
      linkHtml = '<p class="resource-finder__item-title">' + escapeHtml(label) + '</p>';
    }

    var hintHtml = hint
      ? '<p class="resource-finder__item-hint">' + escapeHtml(hint) + '</p>'
      : '';

    var notesHtml = '';
    if (showTitleAsLink) {
      var localizedNote = pickLocalizedField(resource, 'notes');
      var noteText;
      if (localizedNote) {
        noteText = localizedNote;
      } else {
        var rawNote = resource.notes ? String(resource.notes).trim() : '';
        noteText = localizeAutismNote(rawNote);
      }
      if (noteText) {
        notesHtml =
          '<p class="resource-finder__item-note lang-hide-en">' + escapeHtml(noteText) + '</p>';
      }
    }

    return (
      '<article class="resource-finder__item resource-finder__item--compact" data-type="' +
      escapeHtml(typeId) +
      '">' +
      linkHtml +
      notesHtml +
      hintHtml +
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
      '</article>'
    );
  }

  function renderResourceItem(resource, data, stateId, programId, displayMode) {
    if (displayMode === 'compact') {
      return renderCompactItem(resource, stateId, programId);
    }
    return renderDetailedItem(resource, data, stateId, programId);
  }

  function resourceStateIds(resource) {
    return String(resource.state_id || '')
      .toUpperCase()
      .split(/[,\s]+/)
      .map(function (x) {
        return x.trim();
      })
      .filter(Boolean);
  }

  function resourceServesState(resource, stateId) {
    var state = String(stateId || '').toUpperCase();
    if (!state || state === 'NW') return false;
    var parts = resourceStateIds(resource);
    if (parts.indexOf('NW') !== -1 && parts.length === 1) return false;
    return parts.indexOf(state) !== -1;
  }

  function resourceTypeParts(resource) {
    return String(resource.resource_type_id || '')
      .split(/[,\s]+/)
      .map(function (x) {
        return x.trim();
      })
      .filter(Boolean);
  }

  function resourceMatchesTypes(resource, typeIds) {
    if (!typeIds || !typeIds.length) return true;
    var raw = String(resource.resource_type_id || '').trim();
    // Live Google Sheet drops multi-value type cells like "8,9" (column typed as number).
    // Keep those resources instead of hiding them.
    if (!raw) return true;
    if (typeIds.indexOf(raw) !== -1) return true;
    var parts = resourceTypeParts(resource);
    for (var i = 0; i < parts.length; i++) {
      if (typeIds.indexOf(parts[i]) !== -1) return true;
    }
    return false;
  }

  function filterResources(data, programId, stateId, typeIds, includeIds) {
    var programs = String(programId || '')
      .toUpperCase()
      .split(',')
      .map(function (x) {
        return x.trim();
      })
      .filter(Boolean);
    var state = String(stateId || '').toUpperCase();
    var types = (typeIds || []).map(String);
    var extras = (includeIds || []).map(String);
    var results = [];
    var seen = {};

    for (var i = 0; i < data.resources.length; i++) {
      var r = data.resources[i];
      var rid = String(r.resource_id || '');
      var prog = String(r.program_id || '').toUpperCase();
      var matchesProgram = programs.length ? programs.indexOf(prog) !== -1 : false;
      var matchesInclude = extras.length ? extras.indexOf(rid) !== -1 : false;
      if (!matchesProgram && !matchesInclude) continue;
      // Match single or compound state_ids (e.g. "CO, WY"); skip Nationwide-only rows
      if (!resourceServesState(r, state)) continue;
      if (matchesProgram && !resourceMatchesTypes(r, types)) continue;
      if (seen[rid]) continue;
      seen[rid] = true;
      results.push(r);
    }

    // Keep caller type order when possible
    var typeOrder = {};
    for (var t = 0; t < types.length; t++) typeOrder[types[t]] = t;

    results.sort(function (a, b) {
      var aParts = resourceTypeParts(a);
      var bParts = resourceTypeParts(b);
      var aIdx = 99;
      var bIdx = 99;
      for (var ai = 0; ai < aParts.length; ai++) {
        if (typeOrder.hasOwnProperty(aParts[ai])) {
          aIdx = Math.min(aIdx, typeOrder[aParts[ai]]);
        }
      }
      for (var bi = 0; bi < bParts.length; bi++) {
        if (typeOrder.hasOwnProperty(bParts[bi])) {
          bIdx = Math.min(bIdx, typeOrder[bParts[bi]]);
        }
      }
      if (aIdx !== bIdx) return aIdx - bIdx;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });

    return results;
  }

  function fallbackResources(data, programId, stateId, includeIds) {
    // If preferred types are empty for this state, show any matching resources for that state
    return filterResources(data, programId, stateId, [], includeIds);
  }

  function coveredStateIds(data, programId, includeIds) {
    var programs = String(programId || '')
      .toUpperCase()
      .split(',')
      .map(function (x) {
        return x.trim();
      })
      .filter(Boolean);
    var extras = (includeIds || []).map(String);
    var covered = {};

    for (var i = 0; i < (data.resources || []).length; i++) {
      var r = data.resources[i];
      var rid = String(r.resource_id || '');
      var prog = String(r.program_id || '').toUpperCase();
      var matchesProgram = programs.length ? programs.indexOf(prog) !== -1 : false;
      var matchesInclude = extras.length ? extras.indexOf(rid) !== -1 : false;
      if (!matchesProgram && !matchesInclude) continue;
      var parts = resourceStateIds(r);
      for (var p = 0; p < parts.length; p++) {
        if (parts[p] === 'NW') continue;
        covered[parts[p]] = true;
      }
    }
    return covered;
  }

  function populateSelect(select, states, coveredMap) {
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
      if (String(id).toLowerCase() === 'state_id') continue;
      var upper = String(id).toUpperCase();
      if (coveredMap && !coveredMap[upper]) continue;
      var option = document.createElement('option');
      option.value = upper;
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

  function renderResults(container, resources, data, stateId, programId, displayMode, page, pageSize) {
    var wasOpen = container.classList.contains('is-open');
    container.classList.remove('is-open');
    var size = pageSize || PAGE_SIZE;
    var programKey = String(programId || '')
      .split(',')[0]
      .trim()
      .toUpperCase();
    var programName = programDisplayName(data, programId);
    var programNameEsc = escapeHtml(programName);
    var mode = displayMode || 'detailed';
    var currentPage = Math.max(1, page || 1);
    var totalPages = Math.max(1, Math.ceil(resources.length / size));
    if (currentPage > totalPages) currentPage = totalPages;

    container._rfResources = resources;
    container._rfData = data;
    container._rfStateId = stateId;
    container._rfProgramId = programId;
    container._rfDisplayMode = mode;
    container._rfPage = currentPage;
    container._rfPageSize = size;

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
      var start = (currentPage - 1) * size;
      var pageItems = resources.slice(start, start + size);
      var shortProgramName = String(programName || '')
        .replace(/\s+resources$/i, '')
        .trim();
      if (!shortProgramName) shortProgramName = programName || programKey;
      var shortProgramEsc = escapeHtml(shortProgramName);
      var headingHtml =
        programKey === 'EPILEPSY'
          ? t({
              es: 'Recursos de Epilepsy en ' + stateName,
              en: 'Epilepsy resources in ' + stateName,
              pt: 'Recursos de Epilepsy em ' + stateName
            })
          : t({
              es: 'Recursos de ' + shortProgramEsc + ' en ' + stateName,
              en: shortProgramEsc + ' resources in ' + stateName,
              pt: 'Recursos de ' + shortProgramEsc + ' em ' + stateName
            });
      body =
        '<div class="resource-finder__panel">' +
        '<p class="resource-finder__panel-heading">' +
        headingHtml +
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
    var typesAttr = el.getAttribute('data-types');
    if (typesAttr === null) typesAttr = '1,2';
    var displayMode = el.getAttribute('data-display') || 'detailed';
    var includeAttr = el.getAttribute('data-include-ids') || '';
    var pageSizeAttr = parseInt(el.getAttribute('data-page-size'), 10);
    var pageSize = pageSizeAttr > 0 ? pageSizeAttr : PAGE_SIZE;
    var onlyCovered =
      el.getAttribute('data-only-covered-states') === 'true' ||
      String(program).toUpperCase().indexOf('EPILEPSY') !== -1;
    var preferredTypes = String(typesAttr)
      .split(',')
      .map(function (x) {
        return x.trim();
      })
      .filter(Boolean);
    var includeIds = includeAttr
      .split(',')
      .map(function (x) {
        return x.trim();
      })
      .filter(Boolean);

    var select = el.querySelector('.resource-finder__select');
    var results = el.querySelector('.resource-finder__results');
    if (!select || !results) return;

    var covered = onlyCovered ? coveredStateIds(data, program, includeIds) : null;
    populateSelect(select, data.states || [], covered);

    function showForState(stateId, scroll, page) {
      if (!stateId) return;
      var matched = filterResources(data, program, stateId, preferredTypes, includeIds);
      if (!matched.length) {
        matched = fallbackResources(data, program, stateId, includeIds);
      }
      renderResults(results, matched, data, stateId, program, displayMode, page || 1, pageSize);
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
        nextPage,
        results._rfPageSize || pageSize
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
