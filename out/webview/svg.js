"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.svgScript = svgScript;
/**
 * Browser-side webview script: pan/zoom interaction + export.
 * All schematic→SVG rendering is done headlessly in the extension host.
 * This script receives pre-rendered SVG strings and inserts them into the DOM.
 */
function svgScript(pageData) {
    return /* js */ `
const { template, schematicSvg, titleblockSvg } = ${pageData};

// ── Constants ─────────────────────────────────────────────────────────────────
const MM = 1 / 2.54;
const PX = mm => mm * MM;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const wrap  = document.getElementById('wrap');
const svg   = document.getElementById('s');
const gMain = document.getElementById('g');

// ── Viewport state ────────────────────────────────────────────────────────────
let scale = 1, panX = 0, panY = 0;

function applyTransform() {
  gMain.setAttribute('transform', \`translate(\${panX},\${panY}) scale(\${scale})\`);
}

// ── Page setup ────────────────────────────────────────────────────────────────
function setupPage() {
  if (!template) return;
  const t  = template.template;
  const pw = PX(t.paper.width_mm), ph = PX(t.paper.height_mm);
  const m  = PX(t.border.margin_mm);
  const lw = (t.border.line_weight_mm ?? 0.5) * MM;

  const sh = document.getElementById('page-shadow');
  sh.setAttribute('x', 1.2); sh.setAttribute('y', 1.2);
  sh.setAttribute('width', pw); sh.setAttribute('height', ph);

  const bg = document.getElementById('page-bg');
  bg.setAttribute('x', 0); bg.setAttribute('y', 0);
  bg.setAttribute('width', pw); bg.setAttribute('height', ph);

  for (const id of ['grid-minor-rect', 'grid-major-rect']) {
    const r = document.getElementById(id);
    r.setAttribute('x', 0); r.setAttribute('y', 0);
    r.setAttribute('width', pw); r.setAttribute('height', ph);
  }

  const brd = document.getElementById('page-border');
  brd.setAttribute('x', m); brd.setAttribute('y', m);
  brd.setAttribute('width', pw - m * 2); brd.setAttribute('height', ph - m * 2);
  brd.setAttribute('stroke', '#1a4a2e');
  brd.setAttribute('stroke-width', lw);

  // Insert pre-rendered SVG content
  document.getElementById('schematic-g').innerHTML  = schematicSvg  ?? '';
  document.getElementById('titleblock-g').innerHTML = titleblockSvg ?? '';
}

// ── Fit page to viewport ──────────────────────────────────────────────────────
function fitToPage() {
  const W = wrap.clientWidth, H = wrap.clientHeight;
  if (template) {
    const t  = template.template;
    const pw = PX(t.paper.width_mm), ph = PX(t.paper.height_mm);
    const pad = 40;
    scale = Math.min((W - pad * 2) / pw, (H - pad * 2) / ph);
    panX  = (W - pw * scale) / 2;
    panY  = (H - ph * scale) / 2;
  } else {
    scale = 4; panX = 40; panY = 40;
  }
  applyTransform();
}

// ── Resize ────────────────────────────────────────────────────────────────────
function onResize() {
  svg.setAttribute('width',  wrap.clientWidth);
  svg.setAttribute('height', wrap.clientHeight);
}
new ResizeObserver(onResize).observe(wrap);

// ── Init ──────────────────────────────────────────────────────────────────────
onResize();
setupPage();
fitToPage();

// ── Pan ───────────────────────────────────────────────────────────────────────
let dragging = false, lastMX = 0, lastMY = 0;
wrap.addEventListener('mousedown', e => {
  dragging = true; lastMX = e.clientX; lastMY = e.clientY;
  wrap.classList.add('dragging');
});
window.addEventListener('mousemove', e => {
  if (!dragging) return;
  panX += e.clientX - lastMX; panY += e.clientY - lastMY;
  lastMX = e.clientX; lastMY = e.clientY;
  applyTransform();
});
window.addEventListener('mouseup', () => { dragging = false; wrap.classList.remove('dragging'); });

// ── Zoom ──────────────────────────────────────────────────────────────────────
wrap.addEventListener('wheel', e => {
  e.preventDefault();
  const rect     = wrap.getBoundingClientRect();
  const mx       = e.clientX - rect.left, my = e.clientY - rect.top;
  const newScale = Math.max(0.05, Math.min(50, scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
  const f        = newScale / scale;
  panX  = mx - (mx - panX) * f;
  panY  = my - (my - panY) * f;
  scale = newScale;
  applyTransform();
}, { passive: false });

// ── Export ────────────────────────────────────────────────────────────────────
function _renderPng(cb) {
  if (!template) { cb(null); return; }
  const t  = template.template;
  const pw = PX(t.paper.width_mm), ph = PX(t.paper.height_mm);
  const PX_PER_GU = 15; // 150 DPI
  const cw = Math.round(pw * PX_PER_GU), ch = Math.round(ph * PX_PER_GU);

  const clone = svg.cloneNode(true);
  clone.setAttribute('viewBox', \`0 0 \${pw} \${ph}\`);
  clone.setAttribute('width',  String(cw));
  clone.setAttribute('height', String(ch));
  clone.style = '';
  clone.querySelector('#g').setAttribute('transform', '');
  for (const id of ['bg', 'bg-stripe', 'grid-minor-rect', 'grid-major-rect', 'page-shadow']) {
    clone.querySelector('#' + id)?.setAttribute('display', 'none');
  }
  clone.querySelector('#page-bg')?.setAttribute('fill', 'white');

  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    cb(canvas.toDataURL('image/png'));
  };
  img.onerror = () => { URL.revokeObjectURL(url); cb(null); };
  img.src = url;
}

function exportPng() {
  _renderPng(dataUrl => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.download = 'schematic.png'; a.href = dataUrl; a.click();
  });
}

function exportPdf() {
  const savedScale = scale, savedPanX = panX, savedPanY = panY;
  if (template) {
    const t  = template.template;
    const pw = PX(t.paper.width_mm), ph = PX(t.paper.height_mm);
    svg.setAttribute('viewBox', \`-1 -1 \${pw + 2} \${ph + 2}\`);
    gMain.setAttribute('transform', '');
  }
  window.print();
  svg.removeAttribute('viewBox');
  scale = savedScale; panX = savedPanX; panY = savedPanY;
  applyTransform();
}
`;
}
//# sourceMappingURL=svg.js.map