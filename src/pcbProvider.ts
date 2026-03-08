import * as vscode from 'vscode';
import * as path from 'path';
import type {
  PcbRoot, PcbTrace, PcbRect, PcbJumper, ResolvedComponent,
} from './pcbRender';
import {
  resolveComponents, renderCopper, renderJumpers, renderOverlays,
  rotatePad, rotateOutline, COPPER, OUTLINE_COLOR, JUMPER_WIRE_COLOR, JUMPER_DEFAULT_PAD_DIA,
} from './pcbRender';

export class PcbEditorProvider implements vscode.CustomTextEditorProvider {
  private readonly panels = new Map<string, vscode.WebviewPanel>();

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    const key = document.uri.toString();
    this.panels.set(key, webviewPanel);
    webviewPanel.webview.options = { enableScripts: true };

    const render = () => {
      webviewPanel.webview.html = this.buildWebviewHtml(document);
    };

    const sub = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === key) render();
    });

    const msgSub = webviewPanel.webview.onDidReceiveMessage(async msg => {
      if (msg.type === 'exportPdf') {
        await this.exportPdfVector(document);
      }
    });

    webviewPanel.onDidDispose(() => {
      this.panels.delete(key);
      sub.dispose();
      msgSub.dispose();
    });

    render();
  }

  private buildWebviewHtml(document: vscode.TextDocument): string {
    let pcb: PcbRoot | null = null;
    let parseError = false;
    try {
      pcb = JSON.parse(document.getText()) as PcbRoot;
    } catch {
      parseError = true;
    }

    const title = pcb?.pcb?.titleblock?.name ?? 'PCB';
    const boardW = pcb?.pcb?.board?.width_mm ?? 50;
    const boardH = pcb?.pcb?.board?.height_mm ?? 50;
    const traces = pcb?.pcb?.traces ?? [];
    const rects = pcb?.pcb?.rects ?? [];
    const jumpers = pcb?.pcb?.jumpers ?? [];

    // Resolve component footprints via schematic imports
    const pcbDir = path.dirname(document.uri.fsPath);
    const components = resolveComponents(pcb, pcbDir);

    // Pre-render SVG layers
    const copperSvg = renderCopper(boardH, traces, rects, components);
    const jumpersSvg = renderJumpers(boardH, jumpers);
    const overlaysSvg = renderOverlays(boardH, components);

    const pageData = JSON.stringify({ boardW, boardH });

    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      display: flex; flex-direction: column; height: 100vh; overflow: hidden;
      font-family: var(--vscode-font-family, sans-serif);
      background: #1e1e1e; color: #ccc;
    }
    header {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 16px; border-bottom: 1px solid #333;
      flex-shrink: 0; background: #252526;
    }
    .badge {
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      background: #2e7d32; color: #fff; padding: 2px 7px; border-radius: 100px;
    }
    h1 { font-size: .95em; font-weight: 600; color: #ccc; }
    .err {
      background: #5a1d1d; color: #f48771;
      padding: 5px 16px; font-size: .85em; flex-shrink: 0;
    }
    #wrap {
      flex: 1; overflow: hidden; position: relative;
      cursor: grab; user-select: none;
    }
    #wrap.dragging { cursor: grabbing; }
    svg { display: block; }

    .pdf-btn {
      margin-left: auto;
      padding: 4px 12px; border: 1px solid #555; border-radius: 4px;
      background: #2d2d2d; color: #ccc; font-size: .85em; cursor: pointer;
    }
    .pdf-btn:hover { background: #3e3e3e; }
    .pdf-btn + .pdf-btn { margin-left: 6px; }

    @media print {
      header, .err { display: none; }
      body { display: block; background: white; }
      #wrap { width: 100vw; height: 100vh; background: white; cursor: default; }
      #s { width: 100vw !important; height: 100vh !important; }
      #bg, #bg-stripe, #board-shadow { display: none; }
    }
  </style>
</head>
<body>
  <header>
    <span class="badge">vibepcb</span>
    <h1>${title}</h1>
    <button class="pdf-btn" onclick="exportPng()">Export PNG</button>
    <button class="pdf-btn" onclick="exportPdf()">Export PDF</button>
  </header>
  ${parseError ? '<div class="err">JSON parse error — check file syntax</div>' : ''}
  <div id="wrap">
    <svg id="s" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="pat-bg-stripe" patternUnits="userSpaceOnUse" width="12" height="12">
          <line x1="0" y1="0" x2="12" y2="12" stroke="rgba(0,0,0,0.18)" stroke-width="1"/>
        </pattern>
      </defs>

      <rect id="bg" width="100%" height="100%" fill="#3a3a3a"/>
      <rect id="bg-stripe" width="100%" height="100%" fill="url(#pat-bg-stripe)"/>

      <g id="g">
        <rect id="board-shadow" fill="rgba(0,0,0,0.55)"/>
        <rect id="board-bg" fill="#2e7d32"/>
        <g id="copper-g">${copperSvg}</g>
        <g id="jumper-g">${jumpersSvg}</g>
        <g id="overlay-g">${overlaysSvg}</g>
      </g>
    </svg>
  </div>
  <script>const vscode = acquireVsCodeApi();</script>
  <script>${pcbScript(pageData)}</script>
</body>
</html>`;
  }

  private async exportPdfVector(document: vscode.TextDocument): Promise<void> {
    let pcb: PcbRoot | null = null;
    try {
      pcb = JSON.parse(document.getText()) as PcbRoot;
    } catch {
      vscode.window.showErrorMessage('Cannot export PDF: invalid JSON');
      return;
    }

    const boardW = pcb?.pcb?.board?.width_mm ?? 50;
    const boardH = pcb?.pcb?.board?.height_mm ?? 50;
    const traces = pcb?.pcb?.traces ?? [];
    const rects = pcb?.pcb?.rects ?? [];
    const jumpers = pcb?.pcb?.jumpers ?? [];
    const pcbDir = path.dirname(document.uri.fsPath);
    const components = resolveComponents(pcb, pcbDir);
    const title = pcb?.pcb?.titleblock?.name ?? 'PCB';

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(
        path.join(pcbDir, title.replace(/[^a-zA-Z0-9_\-]/g, '_') + '.pdf')
      ),
      filters: { 'PDF': ['pdf'] },
    });
    if (!uri) return;

    const pdfBytes = buildVectorPdf(boardW, boardH, traces, rects, jumpers, components, title);
    await vscode.workspace.fs.writeFile(uri, pdfBytes);
    vscode.window.showInformationMessage(`PDF saved to ${path.basename(uri.fsPath)}`);
  }
}

// ── Vector PDF builder ────────────────────────────────────────────────────────

/** mm → PDF points (1 pt = 1/72 in, 1 in = 25.4 mm) */
const PT_PER_MM = 72 / 25.4;

function pdfColor(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: ((n >> 16) & 0xff) / 255, g: ((n >> 8) & 0xff) / 255, b: (n & 0xff) / 255 };
}

function f(n: number): string { return n.toFixed(4); }

/** Escape a string for a PDF text object */
function pdfEsc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildVectorPdf(
  boardW: number, boardH: number,
  traces: PcbTrace[], rects: PcbRect[], jumpers: PcbJumper[],
  components: ResolvedComponent[], title: string
): Uint8Array {
  const pad = 2; // mm margin around board
  const totalW = (boardW + pad * 2) * PT_PER_MM;
  const totalH = (boardH + pad * 2) * PT_PER_MM;
  const offX = pad * PT_PER_MM;
  const offY = pad * PT_PER_MM;

  // PDF uses bottom-left origin — our board coords are already bottom-left,
  // but the SVG rendering flipped Y. For PDF we work in native board coords.
  const ops: string[] = [];

  // Board background (green)
  const bg = pdfColor('#2e7d32');
  ops.push(`${f(bg.r)} ${f(bg.g)} ${f(bg.b)} rg`);
  ops.push(`${f(offX)} ${f(offY)} ${f(boardW * PT_PER_MM)} ${f(boardH * PT_PER_MM)} re f`);

  // Copper fills (rects + pads)
  const cop = pdfColor(COPPER);
  ops.push(`${f(cop.r)} ${f(cop.g)} ${f(cop.b)} rg`);
  ops.push(`${f(cop.r)} ${f(cop.g)} ${f(cop.b)} RG`);

  for (const r of rects) {
    const x = Math.min(r.from.x, r.to.x) * PT_PER_MM + offX;
    const y = Math.min(r.from.y, r.to.y) * PT_PER_MM + offY;
    const w = Math.abs(r.to.x - r.from.x) * PT_PER_MM;
    const h = Math.abs(r.to.y - r.from.y) * PT_PER_MM;
    ops.push(`${f(x)} ${f(y)} ${f(w)} ${f(h)} re f`);
  }

  // Traces (lines with round cap)
  ops.push('1 J'); // round line cap
  for (const t of traces) {
    ops.push(`${f(t.width_mm * PT_PER_MM)} w`);
    ops.push(`${f(t.from.x * PT_PER_MM + offX)} ${f(t.from.y * PT_PER_MM + offY)} m`);
    ops.push(`${f(t.to.x * PT_PER_MM + offX)} ${f(t.to.y * PT_PER_MM + offY)} l S`);
  }

  // Component pads
  for (const comp of components) {
    if (!comp.footprint) continue;
    const cx = comp.position.x, cy = comp.position.y;
    for (const p of comp.footprint.pads) {
      const [rpx, rpy] = rotatePad(p.x, p.y, comp.rotation);
      const [rw, rh] = (comp.rotation === 90 || comp.rotation === 270)
        ? [p.height, p.width] : [p.width, p.height];
      const px = (cx + rpx - rw / 2) * PT_PER_MM + offX;
      const py = (cy + rpy - rh / 2) * PT_PER_MM + offY;
      ops.push(`${f(px)} ${f(py)} ${f(rw * PT_PER_MM)} ${f(rh * PT_PER_MM)} re f`);
    }
  }

  // Jumper wires (grey wire, copper pads)
  const jw = pdfColor(JUMPER_WIRE_COLOR);
  for (const j of jumpers) {
    const padDia = j.pad_diameter_mm ?? JUMPER_DEFAULT_PAD_DIA;
    const r = padDia / 2 * PT_PER_MM;
    const x1 = j.from.x * PT_PER_MM + offX, y1 = j.from.y * PT_PER_MM + offY;
    const x2 = j.to.x * PT_PER_MM + offX,   y2 = j.to.y * PT_PER_MM + offY;
    // Landing pads (copper, filled circles approximated as 4-curve Bézier)
    ops.push(`${f(cop.r)} ${f(cop.g)} ${f(cop.b)} rg`);
    const k = 0.5523 * r; // Bézier approximation constant
    for (const [cx, cy] of [[x1, y1], [x2, y2]]) {
      ops.push(`${f(cx)} ${f(cy + r)} m`);
      ops.push(`${f(cx + k)} ${f(cy + r)} ${f(cx + r)} ${f(cy + k)} ${f(cx + r)} ${f(cy)} c`);
      ops.push(`${f(cx + r)} ${f(cy - k)} ${f(cx + k)} ${f(cy - r)} ${f(cx)} ${f(cy - r)} c`);
      ops.push(`${f(cx - k)} ${f(cy - r)} ${f(cx - r)} ${f(cy - k)} ${f(cx - r)} ${f(cy)} c`);
      ops.push(`${f(cx - r)} ${f(cy + k)} ${f(cx - k)} ${f(cy + r)} ${f(cx)} ${f(cy + r)} c`);
      ops.push('f');
    }
    // Wire (solid)
    ops.push(`${f(jw.r)} ${f(jw.g)} ${f(jw.b)} RG`);
    ops.push(`${f(0.2 * PT_PER_MM)} w`);
    ops.push('1 J'); // round cap
    ops.push(`${f(x1)} ${f(y1)} m ${f(x2)} ${f(y2)} l S`);
  }

  // Component outlines (blue, stroked)
  const ol = pdfColor(OUTLINE_COLOR);
  ops.push(`${f(ol.r)} ${f(ol.g)} ${f(ol.b)} RG`);
  ops.push(`${f(0.15 * PT_PER_MM)} w`);
  ops.push('0 J'); // butt cap for outlines

  for (const comp of components) {
    if (!comp.footprint) continue;
    const cx = comp.position.x, cy = comp.position.y;
    const outline = comp.footprint.outline;
    const rot = rotateOutline(outline.x, outline.y, outline.width, outline.height, comp.rotation);
    const rx = (cx + rot.x) * PT_PER_MM + offX;
    const ry = (cy + rot.y) * PT_PER_MM + offY;
    ops.push(`${f(rx)} ${f(ry)} ${f(rot.width * PT_PER_MM)} ${f(rot.height * PT_PER_MM)} re S`);
  }

  // Designator labels
  const fontSize = 1.4 * PT_PER_MM;
  ops.push(`${f(ol.r)} ${f(ol.g)} ${f(ol.b)} rg`);
  for (const comp of components) {
    if (!comp.footprint) continue;
    const tx = comp.position.x * PT_PER_MM + offX;
    const ty = comp.position.y * PT_PER_MM + offY - fontSize * 0.35; // approximate vertical centering
    // Approximate horizontal centering: shift left by ~half the text width
    const approxW = comp.ref.length * fontSize * 0.6;
    ops.push(`BT /F1 ${f(fontSize)} Tf ${f(tx - approxW / 2)} ${f(ty)} Td (${pdfEsc(comp.ref)}) Tj ET`);
  }

  // Title label at top-left
  const titleSize = 2.5 * PT_PER_MM;
  ops.push('0 0 0 rg');
  ops.push(`BT /F1 ${f(titleSize)} Tf ${f(offX)} ${f(totalH - offY + 1 * PT_PER_MM)} Td (${pdfEsc(title)}) Tj ET`);

  const contentStream = ops.join('\n');

  // ── Assemble PDF objects ──────────────────────────────────────────────────
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;

  function add(s: string) {
    const chunk = enc.encode(s);
    parts.push(chunk);
    pos += chunk.length;
  }
  function obj() { offsets.push(pos); }

  add('%PDF-1.4\n');

  obj(); // 1 — Catalog
  add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  obj(); // 2 — Pages
  add('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  obj(); // 3 — Page
  add(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(totalW)} ${f(totalH)}] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >>\nendobj\n`);

  obj(); // 4 — Font (Courier for monospace labels)
  add('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>\nendobj\n');

  obj(); // 5 — Content stream
  add(`5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`);

  // Xref
  const xrefStart = pos;
  const numObjs = offsets.length + 1;
  let xref = `xref\n0 ${numObjs}\n0000000000 65535 f \n`;
  for (const o of offsets) xref += String(o).padStart(10, '0') + ' 00000 n \n';
  xref += `trailer\n<< /Size ${numObjs} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  add(xref);

  // Concatenate all parts
  const total = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { result.set(p, off); off += p.length; }
  return result;
}

function pcbScript(pageData: string): string {
  return /* js */`
const { boardW, boardH } = ${pageData};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const wrap  = document.getElementById('wrap');
const svg   = document.getElementById('s');
const gMain = document.getElementById('g');

// ── Viewport state ────────────────────────────────────────────────────────────
let scale = 1, panX = 0, panY = 0;

function applyTransform() {
  gMain.setAttribute('transform', \`translate(\${panX},\${panY}) scale(\${scale})\`);
}

// ── Board setup ───────────────────────────────────────────────────────────────
function setupBoard() {
  const sh = document.getElementById('board-shadow');
  sh.setAttribute('x', 0.8); sh.setAttribute('y', 0.8);
  sh.setAttribute('width', boardW); sh.setAttribute('height', boardH);

  const bg = document.getElementById('board-bg');
  bg.setAttribute('x', 0); bg.setAttribute('y', 0);
  bg.setAttribute('width', boardW); bg.setAttribute('height', boardH);
}

// ── Fit board to viewport ─────────────────────────────────────────────────────
function fitToBoard() {
  const W = wrap.clientWidth, H = wrap.clientHeight;
  const pad = 60;
  scale = Math.min((W - pad * 2) / boardW, (H - pad * 2) / boardH);
  panX  = (W - boardW * scale) / 2;
  panY  = (H - boardH * scale) / 2;
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
setupBoard();
fitToBoard();

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
const PX_PER_MM = 1000 / 25.4;  // 1000 DPI

function _renderPng(cb) {
  const pad = 2;  // mm padding around board
  const vw = boardW + pad * 2, vh = boardH + pad * 2;
  const cw = Math.round(vw * PX_PER_MM), ch = Math.round(vh * PX_PER_MM);

  const clone = svg.cloneNode(true);
  clone.setAttribute('viewBox', \`\${-pad} \${-pad} \${vw} \${vh}\`);
  clone.setAttribute('width', String(cw));
  clone.setAttribute('height', String(ch));
  clone.style = '';
  clone.querySelector('#g').setAttribute('transform', '');
  for (const id of ['bg', 'bg-stripe', 'board-shadow']) {
    clone.querySelector('#' + id)?.setAttribute('display', 'none');
  }

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
    a.download = 'pcb.png'; a.href = dataUrl; a.click();
  });
}

function exportPdf() {
  vscode.postMessage({ type: 'exportPdf' });
}
`;
}
