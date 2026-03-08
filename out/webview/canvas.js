"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canvasScript = canvasScript;
/**
 * Self-contained canvas renderer script injected into the webview.
 *
 * Unit system: 100mil grid (1 grid unit = 0.1 inch = 2.54 mm).
 * Template measurements are in mm and converted at render time.
 * Pin offsets are in 100mil grid units.
 */
function canvasScript(pageData) {
    return /* js */ `
const { schematic, componentDefs, template } = ${pageData};

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  bg:          '#3a3a3a',
  bgStripe:    'rgba(0,0,0,0.18)',
  pageShadow:  'rgba(0,0,0,0.55)',
  pageBg:      '#fdf8f0',
  gridMinor:   'rgba(26,74,46,0.10)',
  gridMajor:   'rgba(26,74,46,0.28)',
  border:      '#1a4a2e',
  titleblock:  '#1a4a2e',
  tbLabel:     '#4a7a52',
  tbValue:     '#1a1a1a',
  wire:        '#1a4a2e',
  comp:        '#1a4a2e',
  ref:         '#1a5e32',
  val:         '#4a7a52',
};

// ── Unit conversions ──────────────────────────────────────────────────────────
// 1 grid unit = 2.54 mm  →  1 mm = 1/2.54 grid units
const MM  = 1 / 2.54;            // grid units per mm
const PX  = (mm) => mm * MM;     // mm → grid units

// Pin offsets are now defined per-pin in each .vibecomp file (pin.position.dx/dy).

// ── Viewport state ────────────────────────────────────────────────────────────
let scale = 4;        // pixels per 100mil grid unit (default — will be set on first resize)
let panX  = 0;
let panY  = 0;
let dragging = false, lastMX = 0, lastMY = 0;

const canvas   = document.getElementById('c');
const wrap     = document.getElementById('wrap');
const ctx      = canvas.getContext('2d');
const coordsEl = document.getElementById('coords');

// Coordinate converters
const sx  = gx => gx * scale + panX;
const sy  = gy => gy * scale + panY;
const gfx = px => (px - panX) / scale;
const gfy = py => (py - panY) / scale;

// ── Page origin ───────────────────────────────────────────────────────────────
// Schematic (0,0) is at the centre of the page.
// Returns the offset in grid units to add to all schematic coordinates.
function pageOrigin() {
  if (!template) return { x: 0, y: 0 };
  const p = template.template.paper;
  return { x: PX(p.width_mm) / 2, y: PX(p.height_mm) / 2 };
}

// ── Pin map ───────────────────────────────────────────────────────────────────
function buildPinMap() {
  const map    = {};
  const origin = pageOrigin();
  for (const comp of schematic?.schematic?.components ?? []) {
    const def = componentDefs[comp.extends];
    if (!def?.pins) continue;
    const pos = comp.position ?? { x: 0, y: 0 };
    for (const pin of def.pins) {
      const dx = pin.position?.dx ?? 0;
      const dy = pin.position?.dy ?? 0;
      const pt = { x: pos.x + dx + origin.x, y: pos.y + dy + origin.y };
      map[\`\${comp.ref}.\${pin.number}\`] = pt;
      if (pin.name !== '~') map[\`\${comp.ref}.\${pin.name}\`] = pt;
    }
  }
  return map;
}

// ── Drawing primitives ────────────────────────────────────────────────────────
function setLine(color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth   = width;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
}

function drawText(text, x, y, font, color, align = 'left', baseline = 'middle') {
  ctx.font         = font;
  ctx.fillStyle    = color;
  ctx.textAlign    = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
}

// ── Template: paper + border ──────────────────────────────────────────────────
function drawPaper(tmpl) {
  const t  = tmpl.template;
  const pw = PX(t.paper.width_mm);
  const ph = PX(t.paper.height_mm);

  const x0 = sx(0), y0 = sy(0);
  const pw_ = pw * scale, ph_ = ph * scale;

  // Drop shadow
  ctx.fillStyle = C.pageShadow;
  ctx.fillRect(x0 + 4, y0 + 4, pw_, ph_);

  // Page background
  ctx.fillStyle = C.pageBg;
  ctx.fillRect(x0, y0, pw_, ph_);

  // Border rectangle
  const m  = PX(t.border.margin_mm);
  const lw = (t.border.line_weight_mm ?? 0.5) * MM * scale;
  setLine(C.border, lw);
  ctx.strokeRect(sx(m), sy(m), (pw - m * 2) * scale, (ph - m * 2) * scale);
}

// ── Template: title block ─────────────────────────────────────────────────────
function resolveSource(source) {
  if (!source) return '';
  if (source.startsWith('schematic.titleblock.')) {
    const key = source.replace('schematic.titleblock.', '');
    return String(schematic?.schematic?.titleblock?.[key] ?? '');
  }
  if (source === 'auto.date') {
    return new Date().toISOString().slice(0, 10);
  }
  if (source === 'auto.sheet_number') return '1 / 1';
  if (source.startsWith('static:')) return source.slice(7);
  return '';
}

function drawTitleblock(tmpl) {
  const tb   = tmpl.template.titleblock;
  const ox   = PX(tb.position_mm.x);   // top-left of title block in grid units
  const oy   = PX(tb.position_mm.y);
  const lw   = (tb.line_weight_mm ?? 0.3) * MM * scale;
  setLine(C.titleblock, lw);

  // Outer border
  ctx.strokeRect(sx(ox), sy(oy), tb.width_mm * MM * scale, tb.height_mm * MM * scale);

  let rowY = oy;
  for (const row of tb.rows) {
    const rowH = PX(row.height_mm);
    let cellX  = ox;

    for (const cell of row.cells) {
      const cellW = PX(cell.width_mm);

      // Cell border
      setLine(C.titleblock, lw);
      ctx.strokeRect(sx(cellX), sy(rowY), cellW * scale, rowH * scale);

      // Label (small, top-left of cell)
      const labelSizePx = Math.max(1, PX(1.8) * scale);
      drawText(
        cell.label,
        sx(cellX) + 3,
        sy(rowY) + 3,
        \`\${labelSizePx}px monospace\`,
        C.tbLabel,
        'left', 'top'
      );

      // Value (centred vertically, left-aligned with small indent)
      const valSizePx = Math.max(1, PX(cell.font_size_mm ?? 3) * scale);
      const weight    = cell.font_weight === 'bold' ? 'bold ' : '';
      const value     = resolveSource(cell.source);
      drawText(
        value,
        sx(cellX) + 5,
        sy(rowY) + rowH * scale / 2 + labelSizePx * 0.6,
        \`\${weight}\${valSizePx}px sans-serif\`,
        C.tbValue,
        'left', 'middle'
      );

      cellX += cellW;
    }
    rowY += rowH;
  }
}

// ── Generic component renderer ────────────────────────────────────────────────
// Interprets the graphics array from a .vibecomp file.
// Primitives: line | rect | polygon | arrow  (coords in 100mil grid units, relative to centre)

function drawComponentGraphics(ox, oy, graphics) {
  if (!graphics?.length) return;
  const s = scale;

  for (const g of graphics) {
    if (g.type === 'line') {
      setLine(C.comp, 1.5);
      ctx.beginPath();
      ctx.moveTo(ox + g.x1 * s, oy + g.y1 * s);
      ctx.lineTo(ox + g.x2 * s, oy + g.y2 * s);
      ctx.stroke();

    } else if (g.type === 'rect') {
      setLine(C.comp, 1.5);
      ctx.strokeRect(ox + g.x * s, oy + g.y * s, g.width * s, g.height * s);

    } else if (g.type === 'polygon') {
      setLine(C.comp, 1.5);
      ctx.beginPath();
      ctx.moveTo(ox + g.points[0][0] * s, oy + g.points[0][1] * s);
      for (let i = 1; i < g.points.length; i++) {
        ctx.lineTo(ox + g.points[i][0] * s, oy + g.points[i][1] * s);
      }
      ctx.closePath();
      ctx.stroke();

    } else if (g.type === 'arrow') {
      const ax1 = ox + g.x1 * s, ay1 = oy + g.y1 * s;
      const ax2 = ox + g.x2 * s, ay2 = oy + g.y2 * s;
      const ang  = Math.atan2(ay2 - ay1, ax2 - ax1);
      const head = 0.12 * s;
      setLine(C.comp, 1);
      ctx.beginPath();
      ctx.moveTo(ax1, ay1); ctx.lineTo(ax2, ay2);
      ctx.moveTo(ax2, ay2);
      ctx.lineTo(ax2 - head * Math.cos(ang - 0.5), ay2 - head * Math.sin(ang - 0.5));
      ctx.moveTo(ax2, ay2);
      ctx.lineTo(ax2 - head * Math.cos(ang + 0.5), ay2 - head * Math.sin(ang + 0.5));
      ctx.stroke();
    }
  }
}

function getGraphicsBBox(graphics) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const g of graphics ?? []) {
    if (g.type === 'line' || g.type === 'arrow') {
      minX = Math.min(minX, g.x1, g.x2); maxX = Math.max(maxX, g.x1, g.x2);
      minY = Math.min(minY, g.y1, g.y2); maxY = Math.max(maxY, g.y1, g.y2);
    } else if (g.type === 'rect') {
      minX = Math.min(minX, g.x, g.x + g.width);  maxX = Math.max(maxX, g.x, g.x + g.width);
      minY = Math.min(minY, g.y, g.y + g.height); maxY = Math.max(maxY, g.y, g.y + g.height);
    } else if (g.type === 'polygon') {
      for (const [px, py] of g.points) {
        minX = Math.min(minX, px); maxX = Math.max(maxX, px);
        minY = Math.min(minY, py); maxY = Math.max(maxY, py);
      }
    }
  }
  return { minX, maxX, minY, maxY };
}

function drawComponent(pos, def, ref, value) {
  const x = sx(pos.x), y = sy(pos.y), s = scale;
  drawComponentGraphics(x, y, def.graphics);

  const fs   = Math.max(1, s * 0.28);
  const bbox = getGraphicsBBox(def.graphics);
  const cx   = isFinite(bbox.minX) ? x + (bbox.minX + bbox.maxX) / 2 * s : x;
  const refY = isFinite(bbox.minY) ? y + bbox.minY * s - 4             : y - s * 0.35;
  const valY = isFinite(bbox.maxY) ? y + bbox.maxY * s + fs + 2        : y + s * 0.35;

  drawText(ref,   cx, refY, \`bold \${fs}px monospace\`, C.ref, 'center', 'bottom');
  drawText(value, cx, valY, \`\${fs}px monospace\`,      C.val, 'center', 'top');

  // Draw pin names inside the body for named pins
  if (def.pins) {
    const pinFs = Math.max(1, s * 0.22);
    for (const pin of def.pins) {
      if (!pin.name || pin.name === '~') continue;
      const dx = pin.position?.dx ?? 0;
      const dy = pin.position?.dy ?? 0;
      const py = y + dy * s;
      let textX, align;
      if (dx < 0) {
        textX = x + (dx + 1.2) * s;
        align = 'left';
      } else if (dx > 0) {
        textX = x + (dx - 1.2) * s;
        align = 'right';
      } else {
        textX = x + 0.2 * s;
        align = 'left';
      }
      drawText(pin.name, textX, py, \`\${pinFs}px monospace\`, C.comp, align, 'middle');
    }
  }
}

// ── Power symbols ─────────────────────────────────────────────────────────────
function drawVCC(pinPt, netName) {
  const x = sx(pinPt.x), y = sy(pinPt.y), s = scale;
  setLine(C.comp, 1.5);
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x, y - s * 0.8);
  ctx.moveTo(x - s * 0.7, y - s * 0.8); ctx.lineTo(x + s * 0.7, y - s * 0.8);
  ctx.stroke();
  drawText(netName, x, y - s * 1.0, \`bold \${Math.max(1, s*0.30)}px monospace\`, C.comp, 'center', 'bottom');
}

function drawGND(pinPt) {
  const x = sx(pinPt.x), y = sy(pinPt.y), s = scale;
  setLine(C.comp, 1.5);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + s * 0.3); ctx.stroke();
  for (const { w, dy } of [{ w:0.7, dy:0.3 }, { w:0.45, dy:0.65 }, { w:0.2, dy:1.0 }]) {
    ctx.beginPath();
    ctx.moveTo(x - s*w, y + s*dy); ctx.lineTo(x + s*w, y + s*dy);
    ctx.stroke();
  }
}

// ── Nets ──────────────────────────────────────────────────────────────────────
function drawNets(pinMap) {
  for (const net of schematic?.schematic?.nets ?? []) {
    const pts = net.pins.map(p => pinMap[p]).filter(Boolean);
    if (!pts.length) continue;
    if (pts.length === 1) {
      const upper = net.name.toUpperCase();
      const isGnd = ['GND','VSS','AGND','DGND','0V'].includes(upper);
      isGnd ? drawGND(pts[0]) : drawVCC(pts[0], net.name);
    } else {
      setLine(C.wire, 1.5);
      for (let i = 0; i < pts.length - 1; i++) {
        ctx.beginPath();
        ctx.moveTo(sx(pts[i].x), sy(pts[i].y));
        ctx.lineTo(sx(pts[i+1].x), sy(pts[i+1].y));
        ctx.stroke();
      }
      if (pts.length > 2) {
        ctx.fillStyle = C.wire;
        for (const pt of pts.slice(1, -1)) {
          ctx.beginPath();
          ctx.arc(sx(pt.x), sy(pt.y), scale * 0.15, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
}

// ── Grid ──────────────────────────────────────────────────────────────────────
function drawGrid(W, H) {
  const x0 = Math.floor(gfx(0)), x1 = Math.ceil(gfx(W));
  const y0 = Math.floor(gfy(0)), y1 = Math.ceil(gfy(H));
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = C.gridMinor;
  ctx.beginPath();
  for (let gx = x0; gx <= x1; gx++) { ctx.moveTo(sx(gx), 0);  ctx.lineTo(sx(gx), H); }
  for (let gy = y0; gy <= y1; gy++) { ctx.moveTo(0, sy(gy)); ctx.lineTo(W, sy(gy)); }
  ctx.stroke();
  ctx.strokeStyle = C.gridMajor;
  ctx.beginPath();
  const mx0 = Math.floor(gfx(0)/5)*5, mx1 = Math.ceil(gfx(W)/5)*5;
  const my0 = Math.floor(gfy(0)/5)*5, my1 = Math.ceil(gfy(H)/5)*5;
  for (let gx = mx0; gx <= mx1; gx += 5) { ctx.moveTo(sx(gx), 0);  ctx.lineTo(sx(gx), H); }
  for (let gy = my0; gy <= my1; gy += 5) { ctx.moveTo(0, sy(gy)); ctx.lineTo(W, sy(gy)); }
  ctx.stroke();
}

// ── Main draw ─────────────────────────────────────────────────────────────────
function draw() {
  const W = canvas.width, H = canvas.height;

  // Canvas background — solid base + diagonal hatching
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  const spacing = 12;
  ctx.strokeStyle = C.bgStripe;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  // Extend range by W+H so lines cover the canvas at all pan/zoom positions
  for (let i = -(H); i < W + H; i += spacing) {
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H, H);
  }
  ctx.stroke();

  if (template) {
    drawPaper(template);
    drawGrid(W, H);
    drawTitleblock(template);
  } else {
    drawGrid(W, H);
  }

  if (!schematic) return;

  const pinMap = buildPinMap();
  const origin = pageOrigin();
  drawNets(pinMap);

  for (const comp of schematic?.schematic?.components ?? []) {
    if (!comp.position) continue;
    const def = componentDefs[comp.extends];
    if (!def) continue;
    const value   = String(comp.overrides?.properties?.value ?? def.name ?? '');
    const drawPos = { x: comp.position.x + origin.x, y: comp.position.y + origin.y };
    drawComponent(drawPos, def, comp.ref, value);
  }
}

// ── Resize / initial view ─────────────────────────────────────────────────────
let didInitialPan = false;

function fitToPage() {
  if (!template) {
    panX = 40; panY = 40; scale = 40;
    return;
  }
  const t  = template.template;
  const pw = PX(t.paper.width_mm);
  const ph = PX(t.paper.height_mm);
  const W  = canvas.width, H = canvas.height;
  const padding = 40; // px
  const scaleX = (W - padding * 2) / pw;
  const scaleY = (H - padding * 2) / ph;
  scale = Math.min(scaleX, scaleY);
  panX  = (W - pw * scale) / 2;
  panY  = (H - ph * scale) / 2;
}

function resize() {
  canvas.width  = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  if (!didInitialPan) { fitToPage(); didInitialPan = true; }
  draw();
}

new ResizeObserver(resize).observe(wrap);

// ── Pan ───────────────────────────────────────────────────────────────────────
wrap.addEventListener('mousedown', e => {
  dragging = true; lastMX = e.clientX; lastMY = e.clientY;
  wrap.classList.add('dragging');
});
window.addEventListener('mousemove', e => {
  const rect = wrap.getBoundingClientRect();
  const origin = pageOrigin();
  coordsEl.textContent =
    \`\${(gfx(e.clientX - rect.left) - origin.x).toFixed(1)}, \${(gfy(e.clientY - rect.top) - origin.y).toFixed(1)}  (100mil)\`;
  if (!dragging) return;
  panX += e.clientX - lastMX; panY += e.clientY - lastMY;
  lastMX = e.clientX; lastMY = e.clientY;
  draw();
});
window.addEventListener('mouseup', () => { dragging = false; wrap.classList.remove('dragging'); });

// ── Zoom ──────────────────────────────────────────────────────────────────────
wrap.addEventListener('wheel', e => {
  e.preventDefault();
  const rect = wrap.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const f  = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  panX  = mx - (mx - panX) * f;
  panY  = my - (my - panY) * f;
  scale = Math.max(0.5, Math.min(220, scale * f));
  draw();
}, { passive: false });
`;
}
//# sourceMappingURL=canvas.js.map