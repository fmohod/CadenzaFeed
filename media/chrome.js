/* ============================================================
   chrome.js -- the media page's own top bar and menu
   cadenzaarthouse.com/media/  (owner's ask, 2026-10-09)

   Plain JavaScript, no dependencies. It is a separate file from media.js
   on purpose: media.js is mirrored line for line between the two sites, and
   this is only THIS site's page chrome (see media/README.md).

   - The bar slides away when you scroll down and comes back when you scroll
     up, when you are near the top, when the menu is open, and whenever
     keyboard focus is inside it.
   - The menu holds the site's navigation. It opens from the Menu button and
     closes from Close, from the dark area beside it, from Escape, and when
     you follow a link inside it. While it is open, focus stays inside it and
     the page behind does not scroll.
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;
  var bar = document.getElementById('mx-bar');
  var btn = document.getElementById('mx-menu-btn');
  var drawer = document.getElementById('mx-drawer');
  var scrim = document.getElementById('mx-scrim');
  var closeBtn = document.getElementById('mx-close');
  if (!bar || !btn || !drawer || !scrim || !closeBtn) return;

  // ── the bar: away on the way down, back on the way up ───────
  var lastY = window.pageYOffset || 0;
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      var y = window.pageYOffset || 0;
      var d = y - lastY;
      if (root.classList.contains('mx-open') || y < 80 || d < -6) {
        bar.classList.remove('is-away');
      } else if (d > 6) {
        bar.classList.add('is-away');
      }
      if (Math.abs(d) > 6) lastY = y;
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  bar.addEventListener('focusin', function () { bar.classList.remove('is-away'); });

  // ── the menu ────────────────────────────────────────────────
  function isOpen() { return root.classList.contains('mx-open'); }

  function openMenu() {
    root.classList.add('mx-open');
    btn.setAttribute('aria-expanded', 'true');
    bar.classList.remove('is-away');
    closeBtn.focus();
  }

  function closeMenu(returnFocus) {
    root.classList.remove('mx-open');
    btn.setAttribute('aria-expanded', 'false');
    if (returnFocus) btn.focus();
  }

  btn.addEventListener('click', function () { if (isOpen()) closeMenu(true); else openMenu(); });
  closeBtn.addEventListener('click', function () { closeMenu(true); });
  scrim.addEventListener('click', function () { closeMenu(true); });

  // a link inside the menu closes it (a link to this same page would otherwise leave it open)
  drawer.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== drawer) {
      if (t.tagName === 'A') { closeMenu(false); return; }
      t = t.parentNode;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu(true);
      return;
    }
    if (e.key === 'Tab') {
      var items = drawer.querySelectorAll('a[href], button:not([disabled])');
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
})();
