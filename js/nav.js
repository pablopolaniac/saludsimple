/* ==========================================
   SaludSimple.org — Navigation (Desktop dropdowns + Mobile)
   ========================================== */

(function () {
  if (window.__saludNavInit) return;
  window.__saludNavInit = true;

  function init() {
    var hamburger = document.querySelector('.hamburger');
    var drawer = document.querySelector('.mobile-drawer');
    var navbar = document.querySelector('.navbar');

    if (hamburger && drawer) {
      hamburger.addEventListener('click', function () {
        hamburger.classList.toggle('active');
        drawer.classList.toggle('open');
        closeAllDropdowns();
      });
    }

    /* Mobile accordion toggles */
    var mobileToggles = document.querySelectorAll('.mobile-drawer__toggle');
    for (var i = 0; i < mobileToggles.length; i++) {
      mobileToggles[i].addEventListener('click', function (e) {
        e.preventDefault();
        var section = this.closest('.mobile-drawer__section');
        if (!section) return;
        var sublinks = section.querySelector('.mobile-drawer__sublinks');
        if (sublinks) {
          sublinks.classList.toggle('open');
          this.classList.toggle('active');
        }
      });
    }

    /* Close drawer on outside click */
    document.addEventListener('click', function (e) {
      if (hamburger && drawer) {
        if (!drawer.contains(e.target) && !hamburger.contains(e.target)) {
          hamburger.classList.remove('active');
          drawer.classList.remove('open');
        }
      }
    });

    /* Scroll shadow */
    window.addEventListener('scroll', function () {
      if (!navbar) return;
      if (window.scrollY > 10) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });

    /* Desktop dropdown: close when clicking outside */
    document.addEventListener('click', function (e) {
      var items = document.querySelectorAll('.navbar__item');
      for (var j = 0; j < items.length; j++) {
        if (!items[j].contains(e.target)) {
          items[j].classList.remove('dropdown-open');
        }
      }
    });

    initNavFit();
  }

  function closeAllDropdowns() {
    var items = document.querySelectorAll('.navbar__item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.remove('dropdown-open');
    }
  }

  /* Prefer full preferred desktop nav; burger only when contents genuinely don't fit */
  function initNavFit() {
    var navbar = document.querySelector('.navbar');
    var inner = document.querySelector('.navbar__inner');
    var links = document.querySelector('.navbar__links');
    var brand = document.querySelector('.navbar__brand');
    var right = document.querySelector('.navbar__right');
    var hamburger = document.querySelector('.hamburger');
    var lang = document.querySelector('.navbar .lang-toggle');
    if (!navbar || !inner || !links || !brand || !right || !lang) return;

    var measuring = false;

    function linksContentWidth() {
      var total = 0;
      var items = links.children;
      for (var i = 0; i < items.length; i++) {
        total += Math.ceil(items[i].getBoundingClientRect().width);
      }
      var styles = window.getComputedStyle(links);
      var gap = parseFloat(styles.columnGap || styles.gap) || 0;
      if (items.length > 1) total += Math.ceil(gap * (items.length - 1));
      return total;
    }

    function innerGap() {
      var styles = window.getComputedStyle(inner);
      return parseFloat(styles.columnGap || styles.gap) || 0;
    }

    function measureNeeded() {
      /* Natural widths of logo+name, full links, and lang toggle (hamburger hidden while measuring) */
      var gap = innerGap();
      return (
        Math.ceil(brand.getBoundingClientRect().width) +
        linksContentWidth() +
        Math.ceil(lang.getBoundingClientRect().width) +
        Math.ceil(gap * 2)
      );
    }

    function rectsOverlap(a, b, pad) {
      return a.right > b.left - pad && a.left < b.right + pad;
    }

    function hasCollision() {
      if (window.getComputedStyle(links).display === 'none') return false;
      var linksBox = links.getBoundingClientRect();
      var brandBox = brand.getBoundingClientRect();
      var rightBox = right.getBoundingClientRect();
      var innerBox = inner.getBoundingClientRect();
      if (linksBox.width < 1) return false;
      /* Nothing may be pushed beyond the visible container edge */
      if (rightBox.right > innerBox.right + 1) return true;
      if (brandBox.left < innerBox.left - 1) return true;
      /* Links block must not cover logo/name */
      if (rectsOverlap(linksBox, brandBox, 2)) return true;
      /* Last nav item must not reach into the right section (lang toggle) */
      var items = links.children;
      if (items.length) {
        var lastItem = items[items.length - 1].getBoundingClientRect();
        if (lastItem.right > rightBox.left - 4) return true;
      }
      /* Individual nav items must not overlap each other */
      for (var i = 1; i < items.length; i++) {
        var prev = items[i - 1].getBoundingClientRect();
        var curr = items[i].getBoundingClientRect();
        if (prev.right > curr.left + 1) return true;
      }
      return false;
    }

    function clearModes() {
      navbar.classList.remove('navbar--measuring');
      navbar.classList.remove('navbar--compact');
      navbar.classList.remove('navbar--wrap');
      navbar.classList.remove('navbar--brand-sm');
    }

    function applyCompact(compact) {
      if (compact) {
        navbar.classList.add('navbar--compact');
      } else {
        navbar.classList.remove('navbar--compact');
        if (document.querySelector('.mobile-drawer')) {
          document.querySelector('.mobile-drawer').classList.remove('open');
        }
        if (hamburger) hamburger.classList.remove('active');
      }
    }

    function updateFit() {
      if (measuring) return;
      measuring = true;

      /* Stage 1: measure single-line (all labels nowrap) */
      clearModes();
      navbar.classList.add('navbar--measuring');

      requestAnimationFrame(function () {
        var styles = window.getComputedStyle(inner);
        var available =
          inner.clientWidth -
          (parseFloat(styles.paddingLeft) || 0) -
          (parseFloat(styles.paddingRight) || 0);
        var singleLineFits = measureNeeded() <= available;

        navbar.classList.remove('navbar--measuring');

        if (singleLineFits) {
          navbar.classList.remove('navbar--wrap');
          applyCompact(false);
          measuring = false;
          return;
        }

        /* Stage 2: enable two-line wrapping, check for any collision */
        navbar.classList.add('navbar--wrap');
        applyCompact(false);

        requestAnimationFrame(function () {
          if (!hasCollision()) {
            /* Safety: one more frame to catch late reflow */
            requestAnimationFrame(function () {
              if (hasCollision()) {
                navbar.classList.remove('navbar--wrap');
                navbar.classList.remove('navbar--brand-sm');
                applyCompact(true);
              }
              measuring = false;
            });
            return;
          }

          /* Stage 2b: also shrink brand name slightly */
          navbar.classList.add('navbar--brand-sm');

          requestAnimationFrame(function () {
            if (!hasCollision()) {
              requestAnimationFrame(function () {
                if (hasCollision()) {
                  navbar.classList.remove('navbar--wrap');
                  navbar.classList.remove('navbar--brand-sm');
                  applyCompact(true);
                }
                measuring = false;
              });
              return;
            }
            /* Stage 3: still collides — hamburger */
            navbar.classList.remove('navbar--wrap');
            navbar.classList.remove('navbar--brand-sm');
            applyCompact(true);
            measuring = false;
          });
        });
      });
    }

    updateFit();
    window.addEventListener('resize', updateFit);
    window.addEventListener('load', updateFit);

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        updateFit();
      });
    }

    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.lang-toggle__btn')) {
        setTimeout(updateFit, 60);
      }
    });

    document.addEventListener('saludsimple:langchange', function () {
      setTimeout(updateFit, 60);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
