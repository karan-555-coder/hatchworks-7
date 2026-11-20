/* EMERALD NOIR · motion layer
 * Organic flow: word-by-word heading rise, circular image reveals, springy card rise,
 * morphing hero blobs, rotating button halos, soft photo parallax and ambient spores.
 * Adds .em-* classes, word wrappers inside headings and aria-hidden decorative nodes only. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function el(tag, cls, parent) { var n = doc.createElement(tag); n.className = cls; n.setAttribute('aria-hidden', 'true'); (parent || doc.body).appendChild(n); return n; }
  function all(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  var outside = function (n) { return !n.closest('header.hw-header, .hw-header, nav, footer, .elementor-location-header, [aria-hidden="true"]'); };

  /* Pages that render inside shadow DOM get the theme sheet too. */
  var shadowRoots = [];
  all('*').forEach(function (host) {
    var sr = host.shadowRoot;
    if (!sr) return;
    shadowRoots.push(sr);
    if (sr.querySelector('link[data-em]')) return;
    var l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = '/styles/emerald.css'; l.setAttribute('data-em', '');
    sr.appendChild(l);
  });
  function deep(sel) { return shadowRoots.reduce(function (list, sr) { return list.concat(all(sel, sr)); }, all(sel)); }

  /* ---------- hero blobs + ambient spores ----------------------------------------------------- */
  var hero = doc.querySelector('.hwh-hero');
  if (hero) ['a', 'b', 'c'].forEach(function (k) { el('span', 'em-blob em-blob--' + k, hero); });
  var amb = el('div', 'em-ambient'); el('i', '', amb); el('i', '', amb);

  /* ---------- button halos ---------------------------------------------------------------------- */
  deep('a.cta, .hwh-cta, .hw-btn--cta, .hwf-cta, .hwh-work-cta, .elementor-button, .hs-button').forEach(function (b) {
    if (b.querySelector(':scope > .em-halo')) return;
    b.classList.add('em-halo-host');
    b.insertBefore(el('span', 'em-halo', b), b.firstChild);
  });

  /* ---------- cards ------------------------------------------------------------------------------ */
  var cards = all('.hwh-bx, .hwh-ccard, .hwh-mcard, .hwh-suite-card, .hwh-award, .hwh-eng-card, .hwh-belief, ' +
                  '.elementor-widget-call-to-action .elementor-cta, .e-loop-item, .elementor-post, .hwh-res a').filter(outside);
  cards.forEach(function (c) { c.classList.add('em-card'); });

  /* ---------- soft parallax on photos ---------------------------------------------------------- */
  var par = reduced ? [] : all('.hwh-ccard-media img, .hwh-res img').filter(outside);
  par.forEach(function (i) { i.classList.add('em-par'); });
  var ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      par.forEach(function (i) {
        var r = i.getBoundingClientRect();
        if (r.bottom < -100 || r.top > innerHeight + 100) return;
        i.style.setProperty('--py', ((r.top + r.height / 2 - innerHeight / 2) * -0.06).toFixed(1) + 'px');
      });
      ticking = false;
    });
  }
  if (par.length) { addEventListener('scroll', onScroll, { passive: true }); onScroll(); }

  /* ---------- reveals ------------------------------------------------------------------------------ */
  if (reduced || !('IntersectionObserver' in window)) return;

  // split heading text into words (text stays in the DOM, only wrapped)
  var heads = all('h2, .hwh-leader-h').filter(function (h) { return outside(h) && !h.closest('.hwh-hero'); });
  heads.forEach(function (h) {
    var i = 0, nodes = [], w = doc.createTreeWalker(h, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) if (n.nodeValue.trim() && !n.parentElement.closest('.ti, [class*="-ic"]')) nodes.push(n);
    nodes.forEach(function (t) {
      var frag = doc.createDocumentFragment();
      t.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(part)); return; }
        var s = doc.createElement('span'); s.className = 'em-w'; s.style.setProperty('--i', i++); s.textContent = part;
        frag.appendChild(s);
      });
      t.parentNode.replaceChild(frag, t);
    });
    h.classList.add('em-words');
  });

  var media = all('.hwh-ccard-media, .hwh-pos-media, .elementor-widget-image .elementor-widget-container').filter(function (m) { return !m.closest('header.hw-header, nav, footer'); });
  media.forEach(function (m) { m.classList.add('em-rv-m'); });
  cards.forEach(function (c) {
    if (c.closest('.hwh-trust-marquee')) return;
    var idx = c.parentElement ? Array.prototype.indexOf.call(c.parentElement.children, c) : 0;
    c.classList.add('em-rv'); c.style.setProperty('--d', (Math.min(idx, 6) * .08).toFixed(2) + 's');
  });
  root.classList.add('em-js');
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var t = en.target; io.unobserve(t); t.classList.add('em-in');
      setTimeout(function () { t.style.removeProperty('--d'); }, 2000);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
  heads.concat(media, cards).forEach(function (n) { io.observe(n); });
})();
