"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildHtml = buildHtml;
const svg_1 = require("./svg");
const renderer_1 = require("../render/renderer");
function buildHtml(title, schematic, componentDefs, template, parseError) {
    const { schematicSvg, titleblockSvg } = (0, renderer_1.renderSchematic)({ schematic, componentDefs, template });
    // Pass only what the browser needs: template for page setup/export, and pre-rendered SVG strings
    const pageData = JSON.stringify({ template, schematicSvg, titleblockSvg });
    return /* html */ `<!DOCTYPE html>
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
      background: #0e639c; color: #fff; padding: 2px 7px; border-radius: 100px;
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
      #bg, #bg-stripe, #grid-minor-rect, #grid-major-rect, #page-shadow { display: none; }
      #page-bg { fill: white !important; }
    }
  </style>
</head>
<body>
  <header>
    <span class="badge">vibesch</span>
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
        <pattern id="pat-grid-minor" patternUnits="userSpaceOnUse" width="1" height="1">
          <path d="M 1 0 L 0 0 0 1" fill="none" stroke="rgba(26,74,46,0.13)" stroke-width="0.05"/>
        </pattern>
        <pattern id="pat-grid-major" patternUnits="userSpaceOnUse" width="5" height="5">
          <path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(26,74,46,0.30)" stroke-width="0.07"/>
        </pattern>
      </defs>

      <rect id="bg" width="100%" height="100%" fill="#3a3a3a"/>
      <rect id="bg-stripe" width="100%" height="100%" fill="url(#pat-bg-stripe)"/>

      <g id="g">
        <rect id="page-shadow" fill="rgba(0,0,0,0.55)" x="0" y="0" width="0" height="0"/>
        <rect id="page-bg"     fill="#fdf8f0"           x="0" y="0" width="0" height="0"/>
        <rect id="grid-minor-rect" fill="url(#pat-grid-minor)" x="0" y="0" width="0" height="0"/>
        <rect id="grid-major-rect" fill="url(#pat-grid-major)" x="0" y="0" width="0" height="0"/>
        <rect id="page-border" fill="none" x="0" y="0" width="0" height="0"/>
        <g id="titleblock-g"></g>
        <g id="schematic-g"></g>
      </g>
    </svg>
  </div>
  <script>${(0, svg_1.svgScript)(pageData)}</script>
</body>
</html>`;
}
//# sourceMappingURL=html.js.map