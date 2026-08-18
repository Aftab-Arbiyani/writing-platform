/**
 * TEMPORARY DIAGNOSTIC — docs/48 §3.18b, the lost row action-menu item click.
 *
 * This file is scaffolding for ONE experiment and is deleted with the fix. It answers the
 * question §3.18b names and could not answer: when a menu-item click is lost, does the DOM
 * event reach the `<li>`, and does rc-menu's React `onClick` run?
 *
 *   (a) the event never reaches the item        → a coordinate race in the harness
 *   (b) it reaches it, no React `onClick`       → product/library defect
 *   (c) `onClick` runs, `items.find` misses     → product defect in `action-menu.tsx`
 *
 * Pass 1 answered (a), and narrowed it further: `mousedown` DOES reach the `<li>`, but the
 * `<li>` is gone from under a stationary pointer by `mouseup`, so the browser fires `click`
 * on the surviving `<ul>` and rc-menu's item handler never runs. Pass 2 (this version) adds
 * the mutation + popup-state records that say WHY the items vanish, which is what decides
 * whether the fix belongs in the app or in the page objects.
 *
 * It must survive a full parallel run (the defect only appears there), so it is passive:
 * capture-phase listeners, a MutationObserver, and one `console.debug` per record. Records
 * are drained by the `page` fixture into `e2e/.diag/` — NOT `test-results/`, which
 * Playwright wipes at the start of every run.
 */
export const ACTION_MENU_DIAG = `(() => {
  if (window.__amDiag) return;
  const log = [];
  window.__amDiag = log;
  let seq = 0;
  const rec = (t, extra) => {
    const r = Object.assign({ t, ms: Math.round(performance.now()) }, extra);
    log.push(r);
    console.debug('AMDIAG ' + JSON.stringify(r));
  };
  const isItem = (n) => n.nodeType === 1 && n.matches && n.matches('li.ant-dropdown-menu-item');
  const stampOne = (el, kind) => {
    if (el.__amStamp) return el.__amStamp;
    el.__amStamp = kind + ++seq;
    el.setAttribute('data-am-stamp', el.__amStamp);
    return el.__amStamp;
  };
  const stampTree = (root) => {
    if (!root || root.nodeType !== 1) return;
    if (isItem(root)) stampOne(root, 'li');
    if (root.matches && root.matches('ul.ant-dropdown-menu')) stampOne(root, 'ul');
    if (!root.querySelectorAll) return;
    root.querySelectorAll('ul.ant-dropdown-menu').forEach((n) => stampOne(n, 'ul'));
    root.querySelectorAll('li.ant-dropdown-menu-item').forEach((n) => stampOne(n, 'li'));
  };
  // The popup wrapper's classes say whether AntD is CLOSING the dropdown (motion-leave /
  // ant-dropdown-hidden) or merely re-rendering its contents.
  const popupState = () => {
    const els = document.querySelectorAll('.ant-dropdown');
    return Array.from(els).map((el) => {
      const ul = el.querySelector('ul.ant-dropdown-menu');
      return {
        cls: el.className.toString().replace(/ant-dropdown-placement-\\S+\\s*/, '').slice(0, 90),
        ulStamp: ul ? ul.getAttribute('data-am-stamp') : null,
        items: ul ? ul.querySelectorAll('li.ant-dropdown-menu-item').length : -1,
        h: ul ? Math.round(ul.getBoundingClientRect().height) : -1,
      };
    });
  };
  const describe = (el) => {
    if (!el || !el.closest) return { tag: String(el) };
    const li = el.closest('li.ant-dropdown-menu-item');
    const ul = el.closest('ul.ant-dropdown-menu');
    return {
      tag: el.tagName,
      itemKey: li ? li.getAttribute('data-menu-id') : null,
      itemStamp: li ? li.getAttribute('data-am-stamp') : null,
      ulStamp: ul ? ul.getAttribute('data-am-stamp') : null,
      ulItems: ul ? ul.querySelectorAll('li.ant-dropdown-menu-item').length : -1,
      label: li ? (li.textContent || '').trim().slice(0, 20) : null,
    };
  };
  const relevant = (el) =>
    !!(el && el.closest && (el.closest('.ant-dropdown') || el.closest('[aria-label^="Actions for"]')));
  ['pointerdown', 'mousedown', 'mouseup', 'pointerup', 'click'].forEach((type) => {
    document.addEventListener(
      type,
      (e) => {
        if (!relevant(e.target)) return;
        rec('dom:' + type, {
          target: describe(e.target),
          x: Math.round(e.clientX),
          y: Math.round(e.clientY),
          popups: popupState(),
        });
      },
      true,
    );
  });
  const observe = () => {
    stampTree(document.documentElement);
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'attributes') {
          // Only the popup wrapper's own class changes; the app churns classes constantly.
          if (m.target.classList && m.target.classList.contains('ant-dropdown'))
            rec('popup:class', { cls: m.target.className.toString().slice(0, 90), state: popupState() });
          continue;
        }
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          stampTree(n);
          if (isItem(n)) rec('item:add', { key: n.getAttribute('data-menu-id'), stamp: n.__amStamp, intoUl: m.target.getAttribute && m.target.getAttribute('data-am-stamp') });
          else if (n.querySelector && n.querySelector('ul.ant-dropdown-menu'))
            rec('popup:add', { state: popupState() });
        }
        for (const n of m.removedNodes) {
          if (n.nodeType !== 1) continue;
          if (isItem(n))
            rec('item:remove', {
              key: n.getAttribute('data-menu-id'),
              stamp: n.getAttribute('data-am-stamp'),
              fromUl: m.target.getAttribute && m.target.getAttribute('data-am-stamp'),
              fromUlLive: m.target.isConnected,
            });
          else if (n.querySelector && n.querySelector('ul.ant-dropdown-menu'))
            rec('popup:remove', { state: popupState() });
        }
      }
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
      attributeOldValue: false,
    });
  };
  // \`addInitScript\` runs before any page script — \`document.documentElement\` may not exist
  // yet, and observing null throws and silently loses every mutation record (pass 1's gap).
  if (document.documentElement) observe();
  else document.addEventListener('readystatechange', function once() {
    if (!document.documentElement) return;
    document.removeEventListener('readystatechange', once);
    observe();
  });
})();`;
