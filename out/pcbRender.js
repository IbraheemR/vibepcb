"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.JUMPER_DEFAULT_PAD_DIA = exports.JUMPER_PAD_COLOR = exports.JUMPER_WIRE_COLOR = exports.OUTLINE_COLOR = exports.COPPER = void 0;
exports.resolveComponents = resolveComponents;
exports.flipY = flipY;
exports.rotatePad = rotatePad;
exports.rotateOutline = rotateOutline;
exports.renderCopper = renderCopper;
exports.renderJumpers = renderJumpers;
exports.renderOverlays = renderOverlays;
exports.buildPcbSvg = buildPcbSvg;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// ── Component resolution ─────────────────────────────────────────────────────
function resolveComponents(pcb, pcbDir) {
    if (!pcb?.pcb?.schematic || !pcb.pcb.placements)
        return [];
    const schPath = path.resolve(pcbDir, pcb.pcb.schematic);
    let schematic = null;
    try {
        schematic = JSON.parse(fs.readFileSync(schPath, 'utf8'));
    }
    catch {
        return [];
    }
    const schDir = path.dirname(schPath);
    const refToAlias = {};
    for (const comp of schematic.schematic?.components ?? []) {
        refToAlias[comp.ref] = comp.extends;
    }
    const aliasToFootprint = {};
    for (const imp of schematic.schematic?.imports ?? []) {
        try {
            const absPath = path.resolve(schDir, imp.path);
            const parsed = JSON.parse(fs.readFileSync(absPath, 'utf8'));
            aliasToFootprint[imp.as] = parsed.component?.footprint_geometry ?? null;
        }
        catch {
            aliasToFootprint[imp.as] = null;
        }
    }
    return pcb.pcb.placements.map(p => ({
        ref: p.ref,
        position: p.position,
        rotation: p.rotation ?? 0,
        footprint: aliasToFootprint[refToAlias[p.ref]] ?? null,
    }));
}
// ── SVG rendering helpers ────────────────────────────────────────────────────
function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function flipY(y, boardH) {
    return boardH - y;
}
function rotatePad(px, py, rot) {
    switch (rot) {
        case 90: return [py, -px];
        case 180: return [-px, -py];
        case 270: return [-py, px];
        default: return [px, py];
    }
}
function rotateOutline(ox, oy, ow, oh, rot) {
    if (rot === 90 || rot === 270) {
        const cx = ox + ow / 2, cy = oy + oh / 2;
        return { x: cx - oh / 2, y: cy - ow / 2, width: oh, height: ow };
    }
    return { x: ox, y: oy, width: ow, height: oh };
}
exports.COPPER = '#d4842a';
exports.OUTLINE_COLOR = '#1a3a6e';
exports.JUMPER_WIRE_COLOR = '#a0a0a0';
exports.JUMPER_PAD_COLOR = '#b0b0b0';
exports.JUMPER_DEFAULT_PAD_DIA = 0.8;
function renderCopper(boardH, traces, rects, components) {
    const parts = [];
    for (const r of rects) {
        const x1 = Math.min(r.from.x, r.to.x);
        const x2 = Math.max(r.from.x, r.to.x);
        const y1 = Math.min(flipY(r.from.y, boardH), flipY(r.to.y, boardH));
        const y2 = Math.max(flipY(r.from.y, boardH), flipY(r.to.y, boardH));
        parts.push(`<rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" fill="${exports.COPPER}"><title>${esc(r.net)}</title></rect>`);
    }
    for (const t of traces) {
        const x1 = t.from.x, y1 = flipY(t.from.y, boardH);
        const x2 = t.to.x, y2 = flipY(t.to.y, boardH);
        parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${exports.COPPER}" stroke-width="${t.width_mm}" stroke-linecap="round"><title>${esc(t.net)}</title></line>`);
    }
    for (const comp of components) {
        if (!comp.footprint)
            continue;
        const cx = comp.position.x;
        const cy = comp.position.y;
        for (const pad of comp.footprint.pads) {
            const [rpx, rpy] = rotatePad(pad.x, pad.y, comp.rotation);
            const [rw, rh] = (comp.rotation === 90 || comp.rotation === 270)
                ? [pad.height, pad.width] : [pad.width, pad.height];
            const sx = cx + rpx - rw / 2;
            const sy = flipY(cy + rpy + rh / 2, boardH);
            parts.push(`<rect x="${sx}" y="${sy}" width="${rw}" height="${rh}" fill="${exports.COPPER}"><title>${esc(comp.ref)} pad ${pad.pin}</title></rect>`);
        }
    }
    return parts.join('\n');
}
function renderJumpers(boardH, jumpers) {
    const parts = [];
    for (const j of jumpers) {
        const padDia = j.pad_diameter_mm ?? exports.JUMPER_DEFAULT_PAD_DIA;
        const r = padDia / 2;
        const x1 = j.from.x, y1 = flipY(j.from.y, boardH);
        const x2 = j.to.x, y2 = flipY(j.to.y, boardH);
        // Landing pads (copper)
        parts.push(`<circle cx="${x1}" cy="${y1}" r="${r}" fill="${exports.COPPER}"><title>${esc(j.net)} jumper pad</title></circle>`);
        parts.push(`<circle cx="${x2}" cy="${y2}" r="${r}" fill="${exports.COPPER}"><title>${esc(j.net)} jumper pad</title></circle>`);
        // Wire
        parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${exports.JUMPER_WIRE_COLOR}" stroke-width="0.2" stroke-linecap="round"><title>${esc(j.net)} jumper</title></line>`);
    }
    return parts.join('\n');
}
function renderOverlays(boardH, components) {
    const parts = [];
    for (const comp of components) {
        if (!comp.footprint)
            continue;
        const cx = comp.position.x;
        const cy = comp.position.y;
        const ol = comp.footprint.outline;
        const rot = rotateOutline(ol.x, ol.y, ol.width, ol.height, comp.rotation);
        const sx = cx + rot.x;
        const sy = flipY(cy - rot.y, boardH);
        parts.push(`<rect x="${sx}" y="${sy}" width="${rot.width}" height="${rot.height}" fill="none" stroke="${exports.OUTLINE_COLOR}" stroke-width="0.15"/>`);
        const labelX = cx;
        const labelY = flipY(cy, boardH);
        parts.push(`<text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="central" fill="${exports.OUTLINE_COLOR}" font-size="1.4" font-family="monospace" font-weight="bold">${esc(comp.ref)}</text>`);
    }
    return parts.join('\n');
}
/**
 * Build a standalone SVG document for a PCB layout.
 * Suitable for rendering to PNG via sharp or other SVG rasterizers.
 */
function buildPcbSvg(pcb, pcbDir) {
    const boardW = pcb.pcb.board?.width_mm ?? 50;
    const boardH = pcb.pcb.board?.height_mm ?? 50;
    const traces = pcb.pcb.traces ?? [];
    const rects = pcb.pcb.rects ?? [];
    const jumpers = pcb.pcb.jumpers ?? [];
    const components = resolveComponents(pcb, pcbDir);
    const pad = 2;
    const vw = boardW + pad * 2;
    const vh = boardH + pad * 2;
    const copperSvg = renderCopper(boardH, traces, rects, components);
    const jumpersSvg = renderJumpers(boardH, jumpers);
    const overlaysSvg = renderOverlays(boardH, components);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${vw} ${vh}" width="${vw}mm" height="${vh}mm">
  <rect x="0" y="0" width="${boardW}" height="${boardH}" fill="#2e7d32"/>
  <g>${copperSvg}</g>
  <g>${jumpersSvg}</g>
  <g>${overlaysSvg}</g>
</svg>`;
}
//# sourceMappingURL=pcbRender.js.map