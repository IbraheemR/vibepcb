"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pageOrigin = pageOrigin;
exports.renderSchematic = renderSchematic;
exports.buildSvgDocument = buildSvgDocument;
const router_1 = require("./router");
const transform_1 = require("./transform");
// ── Constants ─────────────────────────────────────────────────────────────────
const MM = 1 / 2.54;
const PX = (mm) => mm * MM;
const FS = 2.5 * MM;
const SW = 0.5 * MM;
const NW = SW * 0.4;
const C = {
    border: '#1a4a2e',
    titleblock: '#1a4a2e',
    tbLabel: '#4a7a52',
    tbValue: '#1a1a1a',
    comp: '#1a3d6e',
    pin: '#7a3d00',
    ref: '#5a006e',
    val: '#006e4a',
    wire: '#2d6e2d',
    pageBg: '#fdf8f0',
};
function escAttr(v) {
    return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
function escText(v) {
    return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function attrStr(a) {
    return Object.entries(a).map(([k, v]) => `${k}="${escAttr(v)}"`).join(' ');
}
function e(tag, a = {}) {
    return `<${tag} ${attrStr(a)}/>`;
}
function eWrap(tag, a, content) {
    return `<${tag} ${attrStr(a)}>${content}</${tag}>`;
}
function txt(tag, a, text) {
    return eWrap(tag, a, escText(text));
}
// ── Source resolver ───────────────────────────────────────────────────────────
function resolveSource(source, schematic) {
    if (!source)
        return '';
    if (source.startsWith('schematic.titleblock.')) {
        const key = source.replace('schematic.titleblock.', '');
        return String(schematic.schematic.titleblock[key] ?? '');
    }
    if (source === 'auto.date')
        return new Date().toISOString().slice(0, 10);
    if (source === 'auto.sheet_number')
        return '1 / 1';
    if (source.startsWith('static:'))
        return source.slice(7);
    return '';
}
// ── Title block ───────────────────────────────────────────────────────────────
function renderTitleblock(template, schematic) {
    const tb = template.template.titleblock;
    const ox = PX(tb.position_mm.x);
    const oy = PX(tb.position_mm.y);
    const lw = (tb.line_weight_mm ?? 0.3) * MM;
    let out = e('rect', {
        x: ox, y: oy, width: tb.width_mm * MM, height: tb.height_mm * MM,
        stroke: C.titleblock, 'stroke-width': lw, fill: 'none',
    });
    let rowY = oy;
    for (const row of tb.rows) {
        const rowH = PX(row.height_mm);
        let cellX = ox;
        for (const cell of row.cells) {
            const cellW = PX(cell.width_mm);
            out += e('rect', { x: cellX, y: rowY, width: cellW, height: rowH, stroke: C.titleblock, 'stroke-width': lw, fill: 'none' });
            out += txt('text', { x: cellX + PX(0.8), y: rowY + PX(0.8), 'font-size': FS, 'font-family': 'monospace', fill: C.tbLabel, 'text-anchor': 'start', 'dominant-baseline': 'hanging' }, cell.label ?? '');
            out += txt('text', { x: cellX + PX(1), y: rowY + rowH * 0.62, 'font-size': FS, 'font-weight': cell.font_weight === 'bold' ? 'bold' : 'normal', 'font-family': 'sans-serif', fill: C.tbValue, 'text-anchor': 'start', 'dominant-baseline': 'middle' }, resolveSource(cell.source, schematic));
            cellX += cellW;
        }
        rowY += rowH;
    }
    return out;
}
// ── Graphics bbox ─────────────────────────────────────────────────────────────
function graphicsBBox(graphics) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const g of graphics ?? []) {
        if (g.type === 'line' || g.type === 'arrow') {
            minX = Math.min(minX, g.x1, g.x2);
            maxX = Math.max(maxX, g.x1, g.x2);
            minY = Math.min(minY, g.y1, g.y2);
            maxY = Math.max(maxY, g.y1, g.y2);
        }
        else if (g.type === 'rect') {
            minX = Math.min(minX, g.x, g.x + g.width);
            maxX = Math.max(maxX, g.x, g.x + g.width);
            minY = Math.min(minY, g.y, g.y + g.height);
            maxY = Math.max(maxY, g.y, g.y + g.height);
        }
        else if (g.type === 'polygon') {
            for (const [px, py] of g.points) {
                minX = Math.min(minX, px);
                maxX = Math.max(maxX, px);
                minY = Math.min(minY, py);
                maxY = Math.max(maxY, py);
            }
        }
    }
    return { minX, maxX, minY, maxY };
}
// ── Graphics primitives ───────────────────────────────────────────────────────
function renderGraphics(cx, cy, graphics) {
    let out = '';
    for (const g of graphics ?? []) {
        if (g.type === 'line') {
            out += e('line', { x1: cx + g.x1, y1: cy + g.y1, x2: cx + g.x2, y2: cy + g.y2, stroke: C.comp, 'stroke-width': NW, 'stroke-linecap': 'round' });
        }
        else if (g.type === 'rect') {
            out += e('rect', { x: cx + g.x, y: cy + g.y, width: g.width, height: g.height, stroke: C.comp, 'stroke-width': NW, fill: 'none' });
        }
        else if (g.type === 'polygon') {
            const pts = g.points.map(([px, py]) => `${cx + px},${cy + py}`).join(' ');
            out += e('polygon', { points: pts, stroke: C.comp, 'stroke-width': NW, fill: 'none', 'stroke-linejoin': 'round' });
        }
        else if (g.type === 'arrow') {
            const ax1 = cx + g.x1, ay1 = cy + g.y1, ax2 = cx + g.x2, ay2 = cy + g.y2;
            const ang = Math.atan2(ay2 - ay1, ax2 - ax1), h = 0.12;
            const d = `M ${ax1},${ay1} L ${ax2},${ay2}`
                + ` M ${ax2},${ay2} L ${ax2 - h * Math.cos(ang - 0.5)},${ay2 - h * Math.sin(ang - 0.5)}`
                + ` M ${ax2},${ay2} L ${ax2 - h * Math.cos(ang + 0.5)},${ay2 - h * Math.sin(ang + 0.5)}`;
            out += e('path', { d, stroke: C.comp, 'stroke-width': NW, fill: 'none', 'stroke-linecap': 'round' });
        }
    }
    return out;
}
// ── Component ─────────────────────────────────────────────────────────────────
function renderComponent(pos, def, comp) {
    const cx = pos.x, cy = pos.y;
    const rot = (comp.rotation ?? 0);
    const fx = comp.flipX ?? false;
    const fy = comp.flipY ?? false;
    const needsTransform = rot !== 0 || fx || fy;
    let out = renderGraphics(cx, cy, def.graphics);
    const bbox = graphicsBBox(def.graphics);
    const lineH = FS * 1.5;
    let maxDx = 0, maxDy = 0;
    for (const pin of def.pins ?? []) {
        maxDx = Math.max(maxDx, Math.abs(pin.position?.dx ?? 0));
        maxDy = Math.max(maxDy, Math.abs(pin.position?.dy ?? 0));
    }
    const pinsVertical = maxDy >= maxDx;
    const infoLines = [{ text: comp.ref, color: C.ref, bold: true }];
    for (const [key, prop] of Object.entries(def.properties ?? {})) {
        if (!prop || prop.display !== 'shown')
            continue;
        const override = comp.overrides?.properties?.[key];
        const val = override !== undefined ? override : prop.value;
        if (val === null || val === undefined || String(val) === '')
            continue;
        infoLines.push({ text: String(val), color: C.val, bold: false });
    }
    if (pinsVertical) {
        const lx = isFinite(bbox.maxX) ? cx + bbox.maxX + FS * 0.5 : cx + 1.5;
        const startY = cy - (infoLines.length - 1) * lineH / 2;
        for (let i = 0; i < infoLines.length; i++) {
            const ln = infoLines[i];
            out += txt('text', { x: lx, y: startY + i * lineH, 'font-size': FS, 'font-family': 'monospace', 'font-weight': ln.bold ? 'bold' : 'normal', fill: ln.color, 'text-anchor': 'start', 'dominant-baseline': 'middle' }, ln.text);
        }
    }
    else {
        const lx = isFinite(bbox.minX) ? cx + (bbox.minX + bbox.maxX) / 2 : cx;
        const baseY = isFinite(bbox.minY) ? cy + bbox.minY - FS * 0.3 : cy - 1;
        for (let i = 0; i < infoLines.length; i++) {
            const ln = infoLines[infoLines.length - 1 - i];
            out += txt('text', { x: lx, y: baseY - i * lineH, 'font-size': FS, 'font-family': 'monospace', 'font-weight': ln.bold ? 'bold' : 'normal', fill: ln.color, 'text-anchor': 'middle', 'dominant-baseline': 'auto' }, ln.text);
        }
    }
    for (const pin of def.pins ?? []) {
        if (!pin.name || pin.name === '~')
            continue;
        const dx = pin.position?.dx ?? 0, dy = pin.position?.dy ?? 0;
        let tx, pAnchor;
        if (dx < 0) {
            tx = cx + dx + FS * 0.15;
            pAnchor = 'start';
        }
        else if (dx > 0) {
            tx = cx + dx - FS * 0.15;
            pAnchor = 'end';
        }
        else {
            tx = cx + FS * 0.15;
            pAnchor = 'start';
        }
        out += txt('text', { x: tx, y: cy + dy, 'font-size': FS, 'font-family': 'monospace', fill: C.pin, 'text-anchor': pAnchor, 'dominant-baseline': 'middle' }, pin.name);
    }
    if (needsTransform) {
        return eWrap('g', { transform: (0, transform_1.buildSvgTransform)(cx, cy, rot, fx, fy) }, out);
    }
    return out;
}
// ── Power symbols ─────────────────────────────────────────────────────────────
function renderGnd(x, y) {
    const segs = [[0.4, 0], [0.25, 0.22], [0.1, 0.44]];
    let out = e('line', { x1: x, y1: y, x2: x, y2: y + 0.18, stroke: C.wire, 'stroke-width': NW, 'stroke-linecap': 'round' });
    for (const [hw, dy] of segs) {
        out += e('line', { x1: x - hw, y1: y + 0.18 + dy, x2: x + hw, y2: y + 0.18 + dy, stroke: C.wire, 'stroke-width': NW, 'stroke-linecap': 'round' });
    }
    return out;
}
function renderRail(x, y, name) {
    let out = e('line', { x1: x, y1: y, x2: x, y2: y - 0.18, stroke: C.wire, 'stroke-width': NW, 'stroke-linecap': 'round' });
    out += e('line', { x1: x - 0.5, y1: y - 0.18, x2: x + 0.5, y2: y - 0.18, stroke: C.wire, 'stroke-width': NW, 'stroke-linecap': 'round' });
    out += txt('text', { x, y: y - FS * 0.6, 'font-size': FS, 'font-family': 'monospace', fill: C.wire, 'text-anchor': 'middle', 'dominant-baseline': 'auto' }, name);
    return out;
}
function renderNetLabel(x, y, name) {
    const lead = FS * 0.5, hh = FS * 0.65, w = name.length * FS * 0.62 + FS * 0.5;
    const bx = x + lead;
    const pts = `${bx},${y - hh} ${bx + w},${y - hh} ${bx + w},${y + hh} ${bx},${y + hh}`;
    let out = e('line', { x1: x, y1: y, x2: bx, y2: y, stroke: C.wire, 'stroke-width': NW, 'stroke-linecap': 'round' });
    out += e('polygon', { points: pts, stroke: C.wire, 'stroke-width': NW * 0.5, fill: C.pageBg });
    out += txt('text', { x: bx + FS * 0.25, y, 'font-size': FS, 'font-family': 'monospace', fill: C.wire, 'text-anchor': 'start', 'dominant-baseline': 'middle' }, name);
    return out;
}
// ── Pin map ───────────────────────────────────────────────────────────────────
function buildPinMap(schematic, componentDefs, originPt) {
    const map = new Map();
    for (const comp of schematic.schematic.components ?? []) {
        const def = componentDefs[comp.extends];
        if (!def?.pins)
            continue;
        const pos = comp.position ?? { x: 0, y: 0 };
        const rot = (comp.rotation ?? 0);
        const fx = comp.flipX ?? false;
        const fy = comp.flipY ?? false;
        for (const pin of def.pins) {
            const { dx, dy } = (0, transform_1.applyTransform)(pin.position?.dx ?? 0, pin.position?.dy ?? 0, rot, fx, fy);
            const pt = { x: pos.x + dx + originPt.x, y: pos.y + dy + originPt.y };
            map.set(`${comp.ref}.${pin.number}`, pt);
            if (pin.name !== '~')
                map.set(`${comp.ref}.${pin.name}`, pt);
        }
    }
    return map;
}
// ── Nets ──────────────────────────────────────────────────────────────────────
function renderNets(schematic, componentDefs, pinMap, originPt) {
    const routed = (0, router_1.routeAllNets)(schematic, componentDefs, pinMap, originPt);
    let out = '';
    for (const net of schematic.schematic.nets ?? []) {
        const pts = (net.pins ?? []).map(id => pinMap.get(id)).filter((p) => !!p);
        if (net.style === 'gnd') {
            for (const pt of pts)
                out += renderGnd(pt.x, pt.y);
        }
        else if (net.style === 'rail') {
            for (const pt of pts)
                out += renderRail(pt.x, pt.y, net.name);
        }
        else if (net.style === 'label') {
            for (const pt of pts)
                out += renderNetLabel(pt.x, pt.y, net.name);
        }
        else {
            for (const path of (routed.get(net.name) ?? [])) {
                if (path.length < 2)
                    continue;
                const pointsAttr = path.map(p => `${p.x},${p.y}`).join(' ');
                out += e('polyline', { points: pointsAttr, stroke: C.wire, 'stroke-width': NW, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
            }
        }
    }
    return out;
}
// ── Page origin ───────────────────────────────────────────────────────────────
function pageOrigin(template) {
    const p = template.template.paper;
    return { x: Math.round(PX(p.width_mm) / 2), y: Math.round(PX(p.height_mm) / 2) };
}
function renderSchematic(data) {
    const { schematic, componentDefs, template } = data;
    const paperWidth = template ? PX(template.template.paper.width_mm) : 0;
    const paperHeight = template ? PX(template.template.paper.height_mm) : 0;
    const titleblockSvg = template && schematic
        ? renderTitleblock(template, schematic)
        : '';
    let schematicSvg = '';
    if (schematic) {
        const origin = template ? pageOrigin(template) : { x: 0, y: 0 };
        const pinMap = buildPinMap(schematic, componentDefs, origin);
        schematicSvg += renderNets(schematic, componentDefs, pinMap, origin);
        for (const comp of schematic.schematic.components ?? []) {
            if (!comp.position)
                continue;
            const def = componentDefs[comp.extends];
            if (!def)
                continue;
            const drawPos = { x: comp.position.x + origin.x, y: comp.position.y + origin.y };
            schematicSvg += renderComponent(drawPos, def, comp);
        }
    }
    return { paperWidth, paperHeight, schematicSvg, titleblockSvg };
}
/**
 * Build a complete standalone SVG document suitable for file export.
 */
function buildSvgDocument(result, template) {
    const { paperWidth: pw, paperHeight: ph, schematicSvg, titleblockSvg } = result;
    const m = template ? PX(template.template.border.margin_mm) : 2;
    const lw = template ? (template.template.border.line_weight_mm ?? 0.5) * MM : SW;
    const border = e('rect', { x: m, y: m, width: pw - m * 2, height: ph - m * 2, stroke: C.border, 'stroke-width': lw, fill: 'none' });
    const bg = e('rect', { x: 0, y: 0, width: pw, height: ph, fill: C.pageBg });
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${pw}mm" height="${ph}mm" viewBox="0 0 ${pw} ${ph}">
${bg}
${border}
<g id="titleblock-g">${titleblockSvg}</g>
<g id="schematic-g">${schematicSvg}</g>
</svg>`;
}
//# sourceMappingURL=renderer.js.map