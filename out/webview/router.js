"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routerScript = routerScript;
/**
 * A* wire router for the schematic renderer.
 * Works in integer grid-unit coordinates (same space as pinMap).
 * Exported as a JS string injected before svgScript.
 */
function routerScript() {
    return /* js */ `
// ── Wire Router ───────────────────────────────────────────────────────────────

// Minimum binary heap (by .f field)
class MinHeap {
  constructor() { this._d = []; }
  push(item) {
    this._d.push(item);
    let i = this._d.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this._d[p].f <= this._d[i].f) break;
      const t = this._d[p]; this._d[p] = this._d[i]; this._d[i] = t;
      i = p;
    }
  }
  pop() {
    const top = this._d[0];
    const last = this._d.pop();
    if (this._d.length > 0) {
      this._d[0] = last;
      let i = 0;
      for (;;) {
        const l = 2*i+1, r = 2*i+2;
        let m = i;
        if (l < this._d.length && this._d[l].f < this._d[m].f) m = l;
        if (r < this._d.length && this._d[r].f < this._d[m].f) m = r;
        if (m === i) break;
        const t = this._d[m]; this._d[m] = this._d[i]; this._d[i] = t;
        i = m;
      }
    }
    return top;
  }
  get size() { return this._d.length; }
}

// Returns body bbox in component-local coords, excluding pin-stub lines.
// A "stub" line is one whose endpoint coincides with a pin tip.
function _routerBodyBBox(def) {
  const pinTips = new Set();
  for (const pin of def.pins ?? []) {
    pinTips.add((pin.position?.dx ?? 0) + ',' + (pin.position?.dy ?? 0));
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const g of def.graphics ?? []) {
    if (g.type === 'line' || g.type === 'arrow') {
      // Skip stub lines (either endpoint at a pin tip)
      if (pinTips.has(g.x1 + ',' + g.y1) || pinTips.has(g.x2 + ',' + g.y2)) continue;
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

// Prim's MST on points by Manhattan distance; returns [[a,b], ...] pairs
function _primMST(pts) {
  if (pts.length <= 1) return [];
  const inTree = [0];
  const notIn = pts.map((_, i) => i).slice(1);
  const edges = [];
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

// Remove collinear intermediate points
function _simplify(path) {
  if (path.length <= 2) return path;
  const out = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i-1], b = path[i], c = path[i+1];
    if (!((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y))) out.push(b);
  }
  out.push(path[path.length - 1]);
  return out;
}

// A* on integer grid. hardObs: Set<"x,y">, softObs: Map<"x,y", penalty>
function _astar(sx, sy, ex, ey, hardObs, softObs) {
  if (sx === ex && sy === ey) return [{ x: sx, y: sy }];
  const TURN = 3, MAX = 12000;
  const heap = new MinHeap();
  const visited = new Map(); // "x,y,dir" -> g
  heap.push({ x: sx, y: sy, dir: 0, g: 0, f: Math.abs(sx-ex)+Math.abs(sy-ey), prev: null });
  let iter = 0;
  while (heap.size > 0 && iter++ < MAX) {
    const cur = heap.pop();
    const vk = cur.x + ',' + cur.y + ',' + cur.dir;
    if (visited.has(vk) && visited.get(vk) <= cur.g) continue;
    visited.set(vk, cur.g);
    if (cur.x === ex && cur.y === ey) {
      const path = [];
      for (let n = cur; n; n = n.prev) path.unshift({ x: n.x, y: n.y });
      return path;
    }
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = cur.x + dx, ny = cur.y + dy;
      const nkey = nx + ',' + ny;
      if (hardObs.has(nkey) && !(nx === ex && ny === ey)) continue;
      const ndir = dx !== 0 ? 1 : 2;
      const ng = cur.g + 1 + (cur.dir !== 0 && ndir !== cur.dir ? TURN : 0) + (softObs.get(nkey) ?? 0);
      const nvk = nx + ',' + ny + ',' + ndir;
      if (visited.has(nvk) && visited.get(nvk) <= ng) continue;
      heap.push({ x: nx, y: ny, dir: ndir, g: ng, f: ng + Math.abs(nx-ex) + Math.abs(ny-ey), prev: cur });
    }
  }
  // Fallback L-shapes
  if (!hardObs.has(ex + ',' + sy)) return [{ x: sx, y: sy }, { x: ex, y: sy }, { x: ex, y: ey }];
  if (!hardObs.has(sx + ',' + ey)) return [{ x: sx, y: sy }, { x: sx, y: ey }, { x: ex, y: ey }];
  return [{ x: sx, y: sy }, { x: ex, y: ey }];
}

/**
 * Route all non-styled nets. Returns Map<netName, {x,y}[][]>.
 * pinMap: output of buildPinMap() — coords already include pageOrigin offset.
 * originPt: pageOrigin() result (added to component positions for consistency).
 */
function routeAllNets(pinMap, originPt) {
  // Build hard obstacle set
  const hardObs = new Set();
  for (const comp of schematic?.schematic?.components ?? []) {
    const def = componentDefs[comp.extends];
    if (!def || !comp.position) continue;
    const bb = _routerBodyBBox(def);
    if (!bb) continue;
    const cx = comp.position.x + originPt.x;
    const cy = comp.position.y + originPt.y;
    for (let gx = Math.floor(cx + bb.minX) - 1; gx <= Math.ceil(cx + bb.maxX) + 1; gx++) {
      for (let gy = Math.floor(cy + bb.minY) - 1; gy <= Math.ceil(cy + bb.maxY) + 1; gy++) {
        hardObs.add(gx + ',' + gy);
      }
    }
    // Unblock pin tip positions so wires can reach them
    for (const pin of def.pins ?? []) {
      const px = Math.round(cx + (pin.position?.dx ?? 0));
      const py = Math.round(cy + (pin.position?.dy ?? 0));
      hardObs.delete(px + ',' + py);
    }
  }

  // Add soft-obstacle penalty for estimated label areas (wires prefer to avoid them)
  const softObs = new Map(); // "x,y" -> accumulated penalty
  const LABEL_PEN = 8;
  for (const comp of schematic?.schematic?.components ?? []) {
    const def = componentDefs[comp.extends];
    if (!def || !comp.position) continue;
    const bb = _routerBodyBBox(def);
    if (!bb) continue;
    const cx = comp.position.x + originPt.x;
    const cy = comp.position.y + originPt.y;
    // Determine label side same way as the renderer: pinsVertical ↔ maxDy >= maxDx
    let maxDx = 0, maxDy = 0;
    for (const pin of def.pins ?? []) {
      maxDx = Math.max(maxDx, Math.abs(pin.position?.dx ?? 0));
      maxDy = Math.max(maxDy, Math.abs(pin.position?.dy ?? 0));
    }
    let lbMinX, lbMaxX, lbMinY, lbMaxY;
    if (maxDy >= maxDx) {
      // Labels to the RIGHT of body
      lbMinX = cx + bb.maxX + 0.3; lbMaxX = cx + bb.maxX + 3.5;
      lbMinY = cy + bb.minY;       lbMaxY = cy + bb.maxY;
    } else {
      // Labels ABOVE body
      lbMinX = cx + bb.minX;       lbMaxX = cx + bb.maxX;
      lbMinY = cy + bb.minY - 1.8; lbMaxY = cy + bb.minY - 0.1;
    }
    for (let gx = Math.floor(lbMinX); gx <= Math.ceil(lbMaxX); gx++) {
      for (let gy = Math.floor(lbMinY); gy <= Math.ceil(lbMaxY); gy++) {
        const k = gx + ',' + gy;
        softObs.set(k, (softObs.get(k) ?? 0) + LABEL_PEN);
      }
    }
  }

  const result = new Map();  // netName -> [{x,y}[]]

  for (const net of schematic?.schematic?.nets ?? []) {
    if (net.style) continue;
    const pts = (net.pins ?? []).map(id => pinMap[id]).filter(Boolean);
    if (pts.length < 2) continue;

    const edges = _primMST(pts);
    const paths = [];
    for (const [a, b] of edges) {
      const path = _astar(
        Math.round(a.x), Math.round(a.y),
        Math.round(b.x), Math.round(b.y),
        hardObs, softObs
      );
      if (path && path.length >= 2) {
        for (const p of path) {
          const k = p.x + ',' + p.y;
          softObs.set(k, (softObs.get(k) ?? 0) + 4);
        }
        paths.push(_simplify(path));
      }
    }
    result.set(net.name, paths);
  }
  return result;
}
`;
}
//# sourceMappingURL=router.js.map