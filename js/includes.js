/* ==========================================
   SaludSimple.org — Shared Component Loader
   Works with Live Server (http://) and local
   file:// previews by loading JS data files
   (browsers block fetch() on file://).
   ========================================== */

(function () {
  function getBase() {
    var scripts = document.querySelectorAll('script[src*="includes.js"]');
    var src = scripts.length ? scripts[scripts.length - 1].getAttribute('src') : '';
    if (!src) return '';

    // Resolve relative script src against the current page URL
    var abs = new URL(src, window.location.href).href;
    return abs.replace(/\/js\/includes\.js(?:\?.*)?$/i, '');
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = url;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error('Failed to load ' + url)); };
      document.body.appendChild(script);
    });
  }

  function rewriteRootPaths(base) {
    var nodes = document.querySelectorAll('[href^="/"], [src^="/"]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.hasAttribute('href')) {
        el.setAttribute('href', base + el.getAttribute('href'));
      }
      if (el.hasAttribute('src')) {
        el.setAttribute('src', base + el.getAttribute('src'));
      }
    }
  }

  function applySectionTheme() {
    var path = (window.location.pathname || '').replace(/\\/g, '/').toLowerCase();
    var themes = {
      'salud': 'section-theme--accent-1',
      'medicamentos': 'section-theme--accent-2',
      'ninos': 'section-theme--accent-3',
      'sistema': 'section-theme--accent-4',
      'necesidades': 'section-theme--accent-5',
      'mental': 'section-theme--accent-6',
      'recursos-diagnostico': 'section-theme--accent-7'
    };
    var match = path.match(/\/(salud|medicamentos|ninos|sistema|necesidades|mental|recursos-diagnostico)(?:\/|$)/i);
    if (!match || !themes[match[1]]) return;
    document.body.classList.add(themes[match[1]]);

    var root = document.querySelector('.content-page');
    if (!root) return;
    var nodes = root.querySelectorAll('div, a');
    for (var i = 0; i < nodes.length; i++) {
      var style = nodes[i].getAttribute('style') || '';
      if (
        /box-shadow:\s*0\s+2px\s+12px/i.test(style) ||
        /border:\s*[12]px\s+solid\s+rgba\(\s*46\s*,\s*139\s*,\s*122/i.test(style)
      ) {
        nodes[i].classList.add('section-accent-card');
      }
    }
  }

  if (document.body) applySectionTheme();

  function inject(id, html) {
    var el = document.getElementById(id);
    if (el && html) el.innerHTML = html;
  }

  var base = getBase();

  var ready = (document.readyState !== 'loading')
    ? Promise.resolve()
    : new Promise(function (resolve) {
        document.addEventListener('DOMContentLoaded', resolve);
      });

  ready
    .then(function () {
      applySectionTheme();
      return loadScript(base + '/components/navbar-data.js');
    })
    .then(function () {
      return loadScript(base + '/components/footer-data.js');
    })
    .then(function () {
      inject('site-navbar', window.__SITE_NAVBAR_HTML__);
      inject('site-footer', window.__SITE_FOOTER_HTML__);
      rewriteRootPaths(base);
      return loadScript(base + '/js/nav.js');
    })
    .then(function () {
      var plan504 = document.getElementById('site-plan-504');
      if (!plan504) return;
      var extras = Array.prototype.slice.call(
        plan504.querySelectorAll('[data-plan-504-extra]')
      );
      var customExamples = plan504.querySelector('[data-plan-504-examples]');
      var customLetter = plan504.querySelector('[data-plan-504-letter]');
      return loadScript(base + '/components/plan-504-data.js').then(function () {
        inject('site-plan-504', window.__SITE_PLAN_504_HTML__);
        var slot = plan504.querySelector('[data-plan-504-slot]');
        if (slot) {
          for (var i = 0; i < extras.length; i++) {
            slot.appendChild(extras[i]);
          }
        }
        if (customExamples) {
          var list = plan504.querySelector('[data-plan-504-examples-list]');
          if (list) list.replaceWith(customExamples);
        }
        if (customLetter) {
          var letter = plan504.querySelector('[data-plan-504-letter-default]');
          if (letter) letter.replaceWith(customLetter);
        }
      });
    })
    .then(function () {
      return loadScript(base + '/js/faq.js?v=2');
    })
    .then(function () {
      return loadScript(base + '/js/search-data.js');
    })
    .then(function () {
      return loadScript(base + '/js/search.js');
    })
    .then(function () {
      if (typeof window.__SITE_SEARCH_INIT__ === 'function') {
        window.__SITE_SEARCH_INIT__(base);
      }
    })
    .then(function () {
      return loadScript(base + '/js/language.js');
    })
    .catch(function (err) {
      console.error('SaludSimple includes failed:', err);
    });
})();