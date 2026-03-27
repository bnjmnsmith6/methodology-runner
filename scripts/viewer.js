/**
 * AI Assistant Viewer — Progressive Enhancement
 * Handles: menu toggle, content type filtering, JSON expand/collapse, copy to clipboard
 * Vanilla JS — no dependencies — iOS Safari 14+ / Android Chrome 90+
 */

(function () {
  'use strict';

  // ── DOM References ──────────────────────────────────────────────────────────
  const menuToggle  = document.getElementById('menuToggle');
  const mobileMenu  = document.getElementById('mobileMenu');
  const menuOverlay = document.getElementById('menuOverlay');
  const menuClose   = document.getElementById('menuClose');
  const contentFeed = document.getElementById('contentFeed');

  const tabs        = document.querySelectorAll('.tab[data-content-type]');
  const menuItems   = document.querySelectorAll('.menu-item[data-content-type]');
  const contentBlocks = document.querySelectorAll('.content-block[data-type]');

  let currentFilter = 'all';

  // ── Menu Toggle ─────────────────────────────────────────────────────────────

  /**
   * Open the mobile slide-in menu.
   */
  function openMenu() {
    mobileMenu.classList.add('open');
    mobileMenu.setAttribute('aria-hidden', 'false');
    menuOverlay.setAttribute('aria-hidden', 'false');
    menuToggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('menu-open');
    // Move focus to close button
    menuClose.focus();
  }

  /**
   * Close the mobile slide-in menu.
   */
  function closeMenu() {
    mobileMenu.classList.remove('open');
    mobileMenu.setAttribute('aria-hidden', 'true');
    menuOverlay.setAttribute('aria-hidden', 'true');
    menuToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
    // Return focus to toggle
    menuToggle.focus();
  }

  /**
   * Toggle the mobile menu open/closed.
   */
  function toggleMenu() {
    if (mobileMenu.classList.contains('open')) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  if (menuToggle) menuToggle.addEventListener('click', toggleMenu);
  if (menuClose)  menuClose.addEventListener('click', closeMenu);
  if (menuOverlay) menuOverlay.addEventListener('click', closeMenu);

  // Close on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && mobileMenu && mobileMenu.classList.contains('open')) {
      closeMenu();
    }
  });

  // Close menu on focus outside
  if (mobileMenu) {
    mobileMenu.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        const focusable = mobileMenu.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  // ── Content Type Filtering ──────────────────────────────────────────────────

  /**
   * Filter content blocks by type.
   * @param {string} type - Content type ('all', 'text', 'code', 'json', 'table', 'list')
   */
  function renderContent(type) {
    currentFilter = type;

    contentBlocks.forEach(function (block) {
      const blockType = block.getAttribute('data-type');
      if (type === 'all' || blockType === type) {
        block.classList.remove('hidden');
        block.classList.add('fade-in');
        // Remove animation class after it completes to allow re-triggering
        block.addEventListener('animationend', function handler() {
          block.classList.remove('fade-in');
          block.removeEventListener('animationend', handler);
        });
      } else {
        block.classList.add('hidden');
        block.classList.remove('fade-in');
      }
    });

    // Update tab active state
    tabs.forEach(function (tab) {
      const isActive = tab.getAttribute('data-content-type') === type;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Update menu item active state
    menuItems.forEach(function (item) {
      item.classList.toggle('active', item.getAttribute('data-content-type') === type);
    });
  }

  // Attach tab click handlers
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      const type = tab.getAttribute('data-content-type');
      renderContent(type);
    });
  });

  // Attach menu item click handlers
  menuItems.forEach(function (item) {
    item.addEventListener('click', function () {
      const type = item.getAttribute('data-content-type');
      renderContent(type);
      closeMenu();
    });
  });

  // ── Touch Navigation ────────────────────────────────────────────────────────

  /**
   * Handle swipe gestures for tab navigation.
   */
  function handleTouchNavigation() {
    const types = ['all', 'text', 'code', 'json', 'table', 'list'];
    let touchStartX = 0;
    let touchStartY = 0;
    let isSwiping = false;

    if (!contentFeed) return;

    contentFeed.addEventListener('touchstart', function (e) {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
      isSwiping = false;
    }, { passive: true });

    contentFeed.addEventListener('touchmove', function (e) {
      const deltaX = Math.abs(e.changedTouches[0].screenX - touchStartX);
      const deltaY = Math.abs(e.changedTouches[0].screenY - touchStartY);
      // Mark as intentional horizontal swipe (more horizontal than vertical movement)
      if (deltaX > deltaY && deltaX > 10) {
        isSwiping = true;
      }
    }, { passive: true });

    contentFeed.addEventListener('touchend', function (e) {
      if (!isSwiping) return;
      const deltaX = e.changedTouches[0].screenX - touchStartX;
      const threshold = 60; // minimum px to register a swipe

      if (Math.abs(deltaX) < threshold) return;

      const currentIndex = types.indexOf(currentFilter);
      let nextIndex;

      if (deltaX < 0) {
        // Swipe left — next type
        nextIndex = Math.min(currentIndex + 1, types.length - 1);
      } else {
        // Swipe right — previous type
        nextIndex = Math.max(currentIndex - 1, 0);
      }

      if (nextIndex !== currentIndex) {
        renderContent(types[nextIndex]);
        // Scroll the active tab into view
        const activeTab = document.querySelector('.tab.active');
        if (activeTab) {
          activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    }, { passive: true });
  }

  handleTouchNavigation();

  // ── JSON Expand/Collapse ────────────────────────────────────────────────────

  /**
   * Toggle a JSON node open or closed.
   * @param {HTMLElement} node - The .json-node element
   */
  function toggleJsonNode(node) {
    const isCollapsed = node.classList.contains('collapsed');
    const toggle = node.querySelector(':scope > .json-toggle');
    const children = node.querySelector(':scope > .json-children');

    node.classList.toggle('collapsed', !isCollapsed);
    if (toggle) toggle.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');
    if (children) children.setAttribute('aria-hidden', isCollapsed ? 'false' : 'true');
  }

  // Delegate JSON toggle events
  document.addEventListener('click', function (e) {
    const toggle = e.target.closest('.json-toggle');
    if (toggle) {
      const node = toggle.closest('.json-node');
      if (node) toggleJsonNode(node);
    }
  });

  // Expand/collapse all button
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.expand-all-btn');
    if (!btn) return;

    const block = btn.closest('.content-block');
    if (!block) return;

    const nodes = block.querySelectorAll('.json-node');
    const anyCollapsed = Array.from(nodes).some(n => n.classList.contains('collapsed'));

    nodes.forEach(function (node) {
      const toggle = node.querySelector(':scope > .json-toggle');
      const children = node.querySelector(':scope > .json-children');
      node.classList.toggle('collapsed', !anyCollapsed);
      if (toggle) toggle.setAttribute('aria-expanded', anyCollapsed ? 'true' : 'false');
      if (children) children.setAttribute('aria-hidden', anyCollapsed ? 'false' : 'true');
    });

    btn.textContent = anyCollapsed ? 'Collapse All' : 'Expand All';
  });

  // ── Copy to Clipboard ───────────────────────────────────────────────────────

  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.copy-btn');
    if (!btn) return;

    const targetId = btn.getAttribute('data-copy-target');
    const targetEl = targetId ? document.getElementById(targetId) : null;
    const text = targetEl ? targetEl.textContent : '';

    if (!text) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showCopied(btn);
      }).catch(function () {
        fallbackCopy(text, btn);
      });
    } else {
      fallbackCopy(text, btn);
    }
  });

  function showCopied(btn) {
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(function () {
      btn.textContent = original;
      btn.classList.remove('copied');
    }, 2000);
  }

  function fallbackCopy(text, btn) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      showCopied(btn);
    } catch (err) {
      // Silently fail — clipboard not available
    }
    document.body.removeChild(ta);
  }

  // ── Overflow Detection (scroll indicators) ─────────────────────────────────

  function checkOverflow(el, containerClass) {
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth;
    const container = el.closest('.' + containerClass);
    if (container) container.classList.toggle('has-overflow', hasOverflow);

    el.addEventListener('scroll', function () {
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      if (container) container.classList.toggle('has-overflow', !atEnd);
    }, { passive: true });
  }

  document.querySelectorAll('.code-block pre').forEach(function (pre) {
    checkOverflow(pre, 'code-block');
  });

  document.querySelectorAll('.table-wrapper').forEach(function (wrapper) {
    checkOverflow(wrapper, 'table-wrapper');
  });

  // Re-check on resize (debounced)
  let resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      document.querySelectorAll('.code-block pre').forEach(function (pre) {
        checkOverflow(pre, 'code-block');
      });
      document.querySelectorAll('.table-wrapper').forEach(function (wrapper) {
        checkOverflow(wrapper, 'table-wrapper');
      });
    }, 150);
  }, { passive: true });

  // ── Initial state ───────────────────────────────────────────────────────────

  // Initialize visibility
  renderContent('all');

})();
