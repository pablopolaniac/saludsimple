/* ==========================================
   SaludSimple.org — FAQ accordion
   Converts “Preguntas frecuentes” Q&A boxes into expand/collapse items
   ========================================== */

(function () {
  function isFaqHeading(el) {
    if (!el) return false;
    var label = [
      el.getAttribute('data-es') || '',
      el.getAttribute('data-en') || '',
      el.getAttribute('data-pt') || '',
      el.textContent || ''
    ].join(' ');
    return /preguntas frecuentes|frequently asked questions|perguntas frequentes/i.test(label);
  }

  function enhanceItem(box) {
    if (!box || box.classList.contains('faq-item')) return;
    var paras = box.querySelectorAll(':scope > p');
    if (paras.length < 2) return;

    var question = paras[0];
    var answers = Array.prototype.slice.call(paras, 1);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'faq-item__question';
    btn.setAttribute('aria-expanded', 'false');

    var qText = document.createElement('span');
    qText.className = 'faq-item__question-text';
    ['data-es', 'data-en', 'data-pt'].forEach(function (attr) {
      if (question.hasAttribute(attr)) {
        qText.setAttribute(attr, question.getAttribute(attr));
      }
    });
    qText.textContent = question.textContent;

    var chevron = document.createElement('span');
    chevron.className = 'faq-item__chevron';
    chevron.setAttribute('aria-hidden', 'true');

    btn.appendChild(qText);
    btn.appendChild(chevron);

    var answer = document.createElement('div');
    answer.className = 'faq-item__answer';
    answer.hidden = true;
    answers.forEach(function (p) {
      answer.appendChild(p);
    });

    box.className = 'faq-item';
    box.removeAttribute('style');
    box.innerHTML = '';
    box.appendChild(btn);
    box.appendChild(answer);

    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      answer.hidden = open;
      box.classList.toggle('is-open', !open);
    });
  }

  function initFaq() {
    var sections = document.querySelectorAll('.content-page__section');
    for (var i = 0; i < sections.length; i++) {
      var section = sections[i];
      var heading = section.querySelector('.content-page__section-title');
      if (!isFaqHeading(heading)) continue;

      var kids = Array.prototype.slice.call(section.children);
      for (var j = 0; j < kids.length; j++) {
        if (kids[j].tagName === 'DIV') enhanceItem(kids[j]);
      }
    }
  }

  function initCollapsibleSections() {
    var sections = document.querySelectorAll('.content-page__collapse');
    for (var i = 0; i < sections.length; i++) {
      (function (section) {
        var btn = section.querySelector('.content-page__collapse-trigger');
        var panel = section.querySelector('.content-page__collapse-panel');
        if (!btn || !panel || btn.dataset.collapseBound) return;
        btn.dataset.collapseBound = '1';
        btn.addEventListener('click', function () {
          var open = btn.getAttribute('aria-expanded') === 'true';
          btn.setAttribute('aria-expanded', open ? 'false' : 'true');
          panel.hidden = open;
          section.classList.toggle('is-open', !open);
        });
      })(sections[i]);
    }
  }

  function initInfoReveals() {
    var buttons = document.querySelectorAll('.info-reveal__btn');
    for (var i = 0; i < buttons.length; i++) {
      (function (btn) {
        if (btn.dataset.infoBound) return;
        btn.dataset.infoBound = '1';
        var panelId = btn.getAttribute('aria-controls');
        var panel = panelId ? document.getElementById(panelId) : null;
        if (!panel) {
          panel = btn.closest('.info-reveal') && btn.closest('.info-reveal').querySelector('.info-reveal__panel');
        }
        if (!panel) return;
        btn.addEventListener('click', function () {
          var open = btn.getAttribute('aria-expanded') === 'true';
          btn.setAttribute('aria-expanded', open ? 'false' : 'true');
          panel.hidden = open;
        });
      })(buttons[i]);
    }
  }

  function initPreBuiltFaqItems() {
    var items = document.querySelectorAll('.faq-item');
    for (var i = 0; i < items.length; i++) {
      (function (box) {
        var btn = box.querySelector('.faq-item__question');
        var answer = box.querySelector('.faq-item__answer');
        if (!btn || !answer || btn.dataset.faqBound) return;
        btn.dataset.faqBound = '1';
        btn.addEventListener('click', function () {
          var open = btn.getAttribute('aria-expanded') === 'true';
          btn.setAttribute('aria-expanded', open ? 'false' : 'true');
          answer.hidden = open;
          box.classList.toggle('is-open', !open);
        });
      })(items[i]);
    }
  }

  function init() {
    initFaq();
    initPreBuiltFaqItems();
    initCollapsibleSections();
    initInfoReveals();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
