# VibePCB

A text-driven PCB schematic editor for VSCode. VibePCB is designed to be used with AI coding assistants. The included MCP server lets agents export schematics as PNGs to visually inspect layouts. The `demo_pcb/` project includes design logs, calculator scripts, and a `CLAUDE.md` with the full recommended workflow for AI-assisted PCB design.

This project is itself thoroughly vibe coded. Currently only supporting schematics.

Info below all vibe-documented - but hopefully it explains it.

## What it does

- Open `.vibesch` files in VSCode and get a live-rendered schematic
- Define components (`.vibecomp`) with pins, graphics, and properties
- Place components on a grid, declare nets, and let the A* router handle the wiring
- Power rails, ground symbols, and net labels are supported out of the box
- Includes an MCP server so AI agents can export and inspect schematics programmatically

## File formats

| Extension | Purpose |
|---|---|
| `.vibesch` | Schematic — component placement and net connections |
| `.vibecomp` | Component definition — symbol graphics, pins, and properties |
| `.vibeschtemplate` | Page template — paper size, border, title block |

All schematic/component coordinates use a 100 mil grid (1 unit = 2.54 mm). Templates use millimetres.

## Getting started

```bash
npm install
npm run compile
```

Then press F5 in VSCode to launch the extension in a development host. Open any `.vibesch` file to see it rendered.

Check out `demo_pcb/` for a working example project with components, schematics, and design logs.

## How it works

Schematics are JSON files that import component definitions, place instances on a grid, and declare nets between pins. The extension parses the JSON, runs an A* wire router to connect pins, and renders everything as SVG in a VSCode webview.

```json
{
  "schematic": {
    "imports": [
      { "path": "../components/ne555/ne555.vibecomp", "as": "NE555" }
    ],
    "components": [
      { "ref": "U1", "extends": "NE555", "position": { "x": 0, "y": 0 } }
    ],
    "nets": [
      { "name": "VCC", "pins": ["U1.8", "U1.4"], "style": "rail" }
    ]
  }
}
```

## TODO

- [] PDF export broken