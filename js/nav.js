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

  /* Prefer full links; hide site name only if needed; burger as last resort */
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
      /* include flex gaps between items */
      var styles = window.getComputedStyle(links);
      var gap = parseFloat(styles.columnGap || styles.gap) || 0;
      if (items.length > 1) total += Math.ceil(gap * (items.length - 1));
      return total;
    }

    function measureNeeded() {
      return brand.offsetWidth + linksContentWidth() + lang.offsetWidth + 16 + 24;
    }

    function updateFit() {
      if (measuring) return;
      measuring = true;

      navbar.classList.add('navbar--measuring');
      navbar.classList.remove('navbar--compact');
      navbar.classList.remove('navbar--brand-compact');

      requestAnimationFrame(function () {
        var available = inner.clientWidth;
        var fits = measureNeeded() <= available;

        if (!fits) {
          navbar.classList.add('navbar--brand-compact');
          fits = measureNeeded() <= available;
        }

        navbar.classList.remove('navbar--measuring');

        if (fits) {
          navbar.classList.remove('navbar--compact');
          if (document.querySelector('.mobile-drawer')) {
            document.querySelector('.mobile-drawer').classList.remove('open');
          }
          if (hamburger) hamburger.classList.remove('active');
        } else {
          /* Shrink the brand name a bit with the hamburger — never hide it */
          navbar.classList.add('navbar--brand-compact');
          navbar.classList.add('navbar--compact');
        }

        measuring = false;
      });
    }

    updateFit();
    window.addEventListener('resize', updateFit);

    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.lang-toggle__btn')) {
        setTimeout(updateFit, 60);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
