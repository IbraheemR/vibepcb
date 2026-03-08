import * as path from 'path';
import * as fs from 'fs';
import type { SchematicRoot } from './types';

export interface Point { x: number; y: number }

export interface PcbTrace {
  net: string;
  width_mm: number;
  from: Point;
  to: Point;
}

export interface PcbRect {
  net: string;
  from: Point;
  to: Point;
}

export interface PcbJumper {
  net: string;
  from: Point;
  to: Point;
  pad_diameter_mm?: number;
}

export interface PcbPlacement {
  ref: string;
  position: Point;
  rotation?: 0 | 90 | 180 | 270;
}

export interface FootprintPad {
  pin: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FootprintGeometry {
  outline: { x: number; y: number; width: number; height: number };
  pads: FootprintPad[];
}

export interface PcbRoot {
  pcb: {
    schematic?: string;
    titleblock?: { name?: string };
    board: { width_mm: number; height_mm: number };
    placements?: PcbPlacement[];
    traces?: PcbTrace[];
    rects?: PcbRect[];
    jumpers?: PcbJumper[];
  };
}

export interface ResolvedComponent {
  ref: string;
  position: Point;
  rotation: number;
  footprint: FootprintGeometry | null;
}

// ── Component resolution ─────────────────────────────────────────────────────

export function resolveComponents(pcb: PcbRoot | null, pcbDir: string): ResolvedComponent[] {
  if (!pcb?.pcb?.schematic || !pcb.pcb.placements) return [];

  const schPath = path.resolve(pcbDir, pcb.pcb.schematic);
  let schematic: SchematicRoot | null = null;
  try {
    schematic = JSON.parse(fs.readFileSync(schPath, 'utf8')) as SchematicRoot;
  } catch { return []; }

  const schDir = path.dirname(schPath);

  const refToAlias: Record<string, string> = {};
  for (const comp of schematic.schematic?.components ?? []) {
    refToAlias[comp.ref] = comp.extends;
  }

  const aliasToFootprint: Record<string, FootprintGeometry | null> = {};
  for (const imp of schematic.schematic?.imports ?? []) {
    try {
      const absPath = path.resolve(schDir, imp.path);
      const parsed = JSON.parse(fs.readFileSync(absPath, 'utf8'));
      aliasToFootprint[imp.as] = parsed.component?.footprint_geometry ?? null;
    } catch {
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

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function flipY(y: number, boardH: number): number {
  return boardH - y;
}

export function rotatePad(px: number, py: number, rot: number): [number, number] {
  switch (rot) {
    case 90:  return [ py, -px];
    case 180: return [-px, -py];
    case 270: return [-py,  px];
    default:  return [ px,  py];
  }
}

export function rotateOutline(
  ox: number, oy: number, ow: number, oh: number, rot: number
): { x: number; y: number; width: number; height: number } {
  if (rot === 90 || rot === 270) {
    const cx = ox + ow / 2, cy = oy + oh / 2;
    return { x: cx - oh / 2, y: cy - ow / 2, width: oh, height: ow };
  }
  return { x: ox, y: oy, width: ow, height: oh };
}

export const COPPER = '#d4842a';
export const OUTLINE_COLOR = '#1a3a6e';
export const JUMPER_WIRE_COLOR = '#a0a0a0';
export const JUMPER_PAD_COLOR = '#b0b0b0';
export const JUMPER_DEFAULT_PAD_DIA = 0.8;

export function renderCopper(
  boardH: number,
  traces: PcbTrace[],
  rects: PcbRect[],
  components: ResolvedComponent[]
): string {
  const parts: string[] = [];

  for (const r of rects) {
    const x1 = Math.min(r.from.x, r.to.x);
    const x2 = Math.max(r.from.x, r.to.x);
    const y1 = Math.min(flipY(r.from.y, boardH), flipY(r.to.y, boardH));
    const y2 = Math.max(flipY(r.from.y, boardH), flipY(r.to.y, boardH));
    parts.push(`<rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" fill="${COPPER}"><title>${esc(r.net)}</title></rect>`);
  }

  for (const t of traces) {
    const x1 = t.from.x, y1 = flipY(t.from.y, boardH);
    const x2 = t.to.x,   y2 = flipY(t.to.y, boardH);
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COPPER}" stroke-width="${t.width_mm}" stroke-linecap="round"><title>${esc(t.net)}</title></line>`);
  }

  for (const comp of components) {
    if (!comp.footprint) continue;
    const cx = comp.position.x;
    const cy = comp.position.y;
    for (const pad of comp.footprint.pads) {
      const [rpx, rpy] = rotatePad(pad.x, pad.y, comp.rotation);
      const [rw, rh] = (comp.rotation === 90 || comp.rotation === 270)
        ? [pad.height, pad.width] : [pad.width, pad.height];
      const sx = cx + rpx - rw / 2;
      const sy = flipY(cy + rpy + rh / 2, boardH);
      parts.push(`<rect x="${sx}" y="${sy}" width="${rw}" height="${rh}" fill="${COPPER}"><title>${esc(comp.ref)} pad ${pad.pin}</title></rect>`);
    }
  }

  return parts.join('\n');
}

export function renderJumpers(boardH: number, jumpers: PcbJumper[]): string {
  const parts: string[] = [];
  for (const j of jumpers) {
    const padDia = j.pad_diameter_mm ?? JUMPER_DEFAULT_PAD_DIA;
    const r = padDia / 2;
    const x1 = j.from.x, y1 = flipY(j.from.y, boardH);
    const x2 = j.to.x,   y2 = flipY(j.to.y, boardH);
    // Landing pads (copper)
    parts.push(`<circle cx="${x1}" cy="${y1}" r="${r}" fill="${COPPER}"><title>${esc(j.net)} jumper pad</title></circle>`);
    parts.push(`<circle cx="${x2}" cy="${y2}" r="${r}" fill="${COPPER}"><title>${esc(j.net)} jumper pad</title></circle>`);
    // Wire
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${JUMPER_WIRE_COLOR}" stroke-width="0.2" stroke-linecap="round"><title>${esc(j.net)} jumper</title></line>`);
  }
  return parts.join('\n');
}

export function renderOverlays(boardH: number, components: ResolvedComponent[]): string {
  const parts: string[] = [];

  for (const comp of components) {
    if (!comp.footprint) continue;
    const cx = comp.position.x;
    const cy = comp.position.y;
    const ol = comp.footprint.outline;
    const rot = rotateOutline(ol.x, ol.y, ol.width, ol.height, comp.rotation);

    const sx = cx + rot.x;
    const sy = flipY(cy - rot.y, boardH);
    parts.push(`<rect x="${sx}" y="${sy}" width="${rot.width}" height="${rot.height}" fill="none" stroke="${OUTLINE_COLOR}" stroke-width="0.15"/>`);

    const labelX = cx;
    const labelY = flipY(cy, boardH);
    parts.push(`<text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="central" fill="${OUTLINE_COLOR}" font-size="1.4" font-family="monospace" font-weight="bold">${esc(comp.ref)}</text>`);
  }

  return parts.join('\n');
}

/**
 * Build a standalone SVG document for a PCB layout.
 * Suitable for rendering to PNG via sharp or other SVG rasterizers.
 */
export function buildPcbSvg(pcb: PcbRoot, pcbDir: string): string {
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
