/**
 * A* wire router — runs in the extension host (pure TypeScript, no DOM).
 * Operates on integer grid-unit coordinates.
 */
import type { SchematicRoot, ComponentDef } from '../types';
import { applyTransform, type Rotation } from './transform';

export type Point = { x: number; y: number };
type Bbox = { minX: number; maxX: number; minY: number; maxY: number };

// ── Min-heap ──────────────────────────────────────────────────────────────────
class MinHeap<T extends { f: number }> {
  private _d: T[] = [];
  push(item: T): void {
    this._d.push(item);
    let i = this._d.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this._d[p].f <= this._d[i].f) break;
      [this._d[p], this._d[i]] = [this._d[i], this._d[p]];
      i = p;
    }
  }
  pop(): T {
    const top = this._d[0];
    const last = this._d.pop()!;
    if (this._d.length > 0) {
      this._d[0] = last;
      let i = 0;
      for (;;) {
        const l = 2*i+1, r = 2*i+2;
        let m = i;
        if (l < this._d.length && this._d[l].f < this._d[m].f) m = l;
        if (r < this._d.length && this._d[r].f < this._d[m].f) m = r;
        if (m === i) break;
        [this._d[m], this._d[i]] = [this._d[i], this._d[m]];
        i = m;
      }
    }
    return top;
  }
  get size(): number { return this._d.length; }
}

// ── Body bounding box ─────────────────────────────────────────────────────────
// Excludes pin-stub lines (those whose endpoint coincides with a pin tip).
function bodyBBox(def: ComponentDef): Bbox | null {
  const pinTips = new Set<string>();
  for (const pin of def.pins ?? []) {
    pinTips.add(`${pin.position?.dx ?? 0},${pin.position?.dy ?? 0}`);
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const g of def.graphics ?? []) {
    if (g.type === 'line' || g.type === 'arrow') {
      if (pinTips.has(`${g.x1},${g.y1}`) || pinTips.has(`${g.x2},${g.y2}`)) continue;
      minX = Math.min(minX, g.x1, g.x2); maxX = Math.max(maxX, g.x1, g.x2);
      minY = Math.min(minY, g.y1, g.y2); maxY = Math.max(maxY, g.y1, g.y2);
    } else if (g.type === 'rect') {
      minX = Math.min(minX, g.x, g.x + g.width);
      maxX = Math.max(maxX, g.x, g.x + g.width);
      minY = Math.min(minY, g.y, g.y + g.height);
      maxY = Math.max(maxY, g.y, g.y + g.height);
    } else if (g.type === 'polygon') {
      for (const [px, py] of g.points) {
        minX = Math.min(minX, px); maxX = Math.max(maxX, px);
        minY = Math.min(minY, py); maxY = Math.max(maxY, py);
      }
    }
  }
  return isFinite(minX) ? { minX, maxX, minY, maxY } : null;
}

// ── Prim's MST ────────────────────────────────────────────────────────────────
function primMST(pts: Point[]): [Point, Point][] {
  if (pts.length <= 1) return [];
  const inTree = [0];
  const notIn = pts.map((_, i) => i).slice(1);
  const edges: [Point, Point][] = [];
  while (notIn.length > 0) {
    let best = Infinity, bi = -1, bj = -1;
    for (const i of inTree) {
      for (let j = 0; j < notIn.length; j++) {
        const k = notIn[j];
        const d = Math.abs(pts[i].x - pts[k].x) + Math.abs(pts[i].y - pts[k].y);
        if (d < best) { best = d; bi = i; bj = j; }
      }
    }
    edges.push([pts[bi], pts[notIn[bj]]]);
    inTree.push(notIn[bj]);
    notIn.splice(bj, 1);
  }
  return edges;
}

// ── Path simplification ───────────────────────────────────────────────────────
function simplify(path: Point[]): Point[] {
  if (path.length <= 2) return path;
  const out = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i-1], b = path[i], c = path[i+1];
    if (!((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y))) out.push(b);
  }
  out.push(path[path.length - 1]);
  return out;
}

// ── A* pathfinding ────────────────────────────────────────────────────────────
function astar(
  sx: number, sy: number, ex: number, ey: number,
  hardObs: Set<string>, softObs: Map<string, number>
): Point[] {
  if (sx === ex && sy === ey) return [{ x: sx, y: sy }];
  const TURN = 3, MAX = 12000;
  const heap = new MinHeap<{ x: number; y: number; dir: number; g: number; f: number; prev: any }>();
  const visited = new Map<string, number>();
  heap.push({ x: sx, y: sy, dir: 0, g: 0, f: Math.abs(sx-ex)+Math.abs(sy-ey), prev: null });
  let iter = 0;
  while (heap.size > 0 && iter++ < MAX) {
    const cur = heap.pop();
    const vk = `${cur.x},${cur.y},${cur.dir}`;
    if (visited.has(vk) && visited.get(vk)! <= cur.g) continue;
    visited.set(vk, cur.g);
    if (cur.x === ex && cur.y === ey) {
      const path: Point[] = [];
      for (let n: any = cur; n; n = n.prev) path.unshift({ x: n.x, y: n.y });
      return path;
    }
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as [number,number][]) {
      const nx = cur.x + dx, ny = cur.y + dy;
      const nkey = `${nx},${ny}`;
      if (hardObs.has(nkey) && !(nx === ex && ny === ey)) continue;
      const ndir = dx !== 0 ? 1 : 2;
      const ng = cur.g + 1 + (cur.dir !== 0 && ndir !== cur.dir ? TURN : 0) + (softObs.get(nkey) ?? 0);
      const nvk = `${nx},${ny},${ndir}`;
      if (visited.has(nvk) && visited.get(nvk)! <= ng) continue;
      heap.push({ x: nx, y: ny, dir: ndir, g: ng, f: ng + Math.abs(nx-ex) + Math.abs(ny-ey), prev: cur });
    }
  }
  // Fallback L-shapes
  if (!hardObs.has(`${ex},${sy}`)) return [{ x: sx, y: sy }, { x: ex, y: sy }, { x: ex, y: ey }];
  if (!hardObs.has(`${sx},${ey}`)) return [{ x: sx, y: sy }, { x: sx, y: ey }, { x: ex, y: ey }];
  return [{ x: sx, y: sy }, { x: ex, y: ey }];
}

// ── Transform a bounding box by rotation/flip ─────────────────────────────────
function transformBBox(bb: Bbox, rotation: Rotation, flipX: boolean, flipY: boolean): Bbox {
  const corners = [
    applyTransform(bb.minX, bb.minY, rotation, flipX, flipY),
    applyTransform(bb.maxX, bb.minY, rotation, flipX, flipY),
    applyTransform(bb.minX, bb.maxY, rotation, flipX, flipY),
    applyTransform(bb.maxX, bb.maxY, rotation, flipX, flipY),
  ];
  return {
    minX: Math.min(...corners.map(c => c.dx)),
    maxX: Math.max(...corners.map(c => c.dx)),
    minY: Math.min(...corners.map(c => c.dy)),
    maxY: Math.max(...corners.map(c => c.dy)),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Route all non-styled nets. Returns Map<netName, segments[]> in grid-unit coords.
 * pinMap: "REF.num" | "REF.name" → {x,y} (coordinates include pageOrigin offset).
 * originPt: page origin (added to component positions).
 */
export function routeAllNets(
  schematic: SchematicRoot,
  componentDefs: Record<string, ComponentDef>,
  pinMap: Map<string, Point>,
  originPt: Point
): Map<string, Point[][]> {
  const hardObs = new Set<string>();

  for (const comp of schematic.schematic.components ?? []) {
    const def = componentDefs[comp.extends];
    if (!def || !comp.position) continue;
    const rawBb = bodyBBox(def);
    if (!rawBb) continue;
    const rot = (comp.rotation ?? 0) as Rotation;
    const fx  = comp.flipX  ?? false;
    const fy  = comp.flipY  ?? false;
    const bb  = transformBBox(rawBb, rot, fx, fy);
    const cx = comp.position.x + originPt.x;
    const cy = comp.position.y + originPt.y;
    for (let gx = Math.floor(cx + bb.minX) - 1; gx <= Math.ceil(cx + bb.maxX) + 1; gx++) {
      for (let gy = Math.floor(cy + bb.minY) - 1; gy <= Math.ceil(cy + bb.maxY) + 1; gy++) {
        hardObs.add(`${gx},${gy}`);
      }
    }
    for (const pin of def.pins ?? []) {
      const { dx, dy } = applyTransform(pin.position?.dx ?? 0, pin.position?.dy ?? 0, rot, fx, fy);
      const px = Math.round(cx + dx);
      const py = Math.round(cy + dy);
      hardObs.delete(`${px},${py}`);
    }
  }

  // Soft obstacles: label areas
  const softObs = new Map<string, number>();
  const LABEL_PEN = 8;
  for (const comp of schematic.schematic.components ?? []) {
    const def = componentDefs[comp.extends];
    if (!def || !comp.position) continue;
    const rawBb = bodyBBox(def);
    if (!rawBb) continue;
    const rot = (comp.rotation ?? 0) as Rotation;
    const fx  = comp.flipX  ?? false;
    const fy  = comp.flipY  ?? false;
    const bb  = transformBBox(rawBb, rot, fx, fy);
    const cx = comp.position.x + originPt.x;
    const cy = comp.position.y + originPt.y;
    let maxDx = 0, maxDy = 0;
    for (const pin of def.pins ?? []) {
      const t = applyTransform(pin.position?.dx ?? 0, pin.position?.dy ?? 0, rot, fx, fy);
      maxDx = Math.max(maxDx, Math.abs(t.dx));
      maxDy = Math.max(maxDy, Math.abs(t.dy));
    }
    let lbMinX: number, lbMaxX: number, lbMinY: number, lbMaxY: number;
    if (maxDy >= maxDx) {
      lbMinX = cx + bb.maxX + 0.3; lbMaxX = cx + bb.maxX + 3.5;
      lbMinY = cy + bb.minY;       lbMaxY = cy + bb.maxY;
    } else {
      lbMinX = cx + bb.minX;       lbMaxX = cx + bb.maxX;
      lbMinY = cy + bb.minY - 1.8; lbMaxY = cy + bb.minY - 0.1;
    }
    for (let gx = Math.floor(lbMinX); gx <= Math.ceil(lbMaxX); gx++) {
      for (let gy = Math.floor(lbMinY); gy <= Math.ceil(lbMaxY); gy++) {
        const k = `${gx},${gy}`;
        softObs.set(k, (softObs.get(k) ?? 0) + LABEL_PEN);
      }
    }
  }

  const result = new Map<string, Point[][]>();

  for (const net of schematic.schematic.nets ?? []) {
    if (net.style) continue;
    const pts = (net.pins ?? []).map(id => pinMap.get(id)).filter((p): p is Point => !!p);
    if (pts.length < 2) continue;
    const edges = primMST(pts);
    const paths: Point[][] = [];
    for (const [a, b] of edges) {
      const path = astar(
        Math.round(a.x), Math.round(a.y),
        Math.round(b.x), Math.round(b.y),
        hardObs, softObs
      );
      if (path.length >= 2) {
        for (const p of path) {
          const k = `${p.x},${p.y}`;
          softObs.set(k, (softObs.get(k) ?? 0) + 4);
        }
        paths.push(simplify(path));
      }
    }
    result.set(net.name, paths);
  }
  return result;
}
