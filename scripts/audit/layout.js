// Records the geometry and paint of every panel-shaped box, so a before/after
// run says exactly what a CSS change moved or recoloured.
globalThis.__layout = function () {
  const PANEL = /(^|\s)(v4-panel|v4-tier|v4-step|card|tile)(\s|$)/;
  const isPanel = (el) => {
    const className = el.getAttribute('class') || '';
    if (PANEL.test(className)) return true;
    // Anything drawing its own edge is worth tracking even without a named class.
    const style = getComputedStyle(el);
    return parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== 'none';
  };
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
  };
  const out = [];
  let i = 0;
  for (const el of document.querySelectorAll('main *, body > section *')) {
    if (!isPanel(el)) continue;
    const style = getComputedStyle(el);
    out.push({
      i: i++,
      tag: el.tagName.toLowerCase(),
      cls: (el.getAttribute('class') || '').split(' ').slice(0, 3).join(' '),
      box: box(el),
      display: style.display,
      bg: style.backgroundColor,
      color: style.color,
      borderColor: style.borderTopColor,
      borderWidth: style.borderTopWidth,
      radius: style.borderTopLeftRadius,
      text: (el.textContent || '').trim().slice(0, 40),
    });
  }
  return out;
};
