# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Directory Structure

```
root/
  components/
    <part-name>/
      <part>.vibecomp       # Component symbol definition
      <datasheet>.pdf       # Datasheet (where available)
  design_logs/
    001_initial_design.md
    002_timer_blox.md
    ...
  calculators/
    001_<description>.py
    ...
  schematics/
    top_level.vibesch
    timer_blox.vibesch
    ...
```

Each component lives in its own subfolder under `components/`. Each `.vibecomp` and its datasheet PDF sit together in that subfolder.

---

## Workflow

### Datasheets

Use your own knowhow to find components and architect solutions. However when you've chosen a component, you should attempt to download the datasheet, store it as above and read through it to find the standard design procedure.

You don't need to do this for very generic components - e.g resistors/caps.

Prefer wget or curl to fetch datasheets.

### Calculators

Avoid reasoning about and calculating values youself. Write a Python script in `calculators/` that takes key parameters and outputs the required values, following the standard design procedure from the datasheet. You can the iterate using the output, and re-run with nre values if necessary. Name calculator scripts `NNN_<description>.py`.

### Schematic neatness

After editing a schematic, use the `vibepcb_export_schematic` tool to export it as an PNG and inspect the result. Adjust component positions so routing lines do not overlap with each other or with component bodies. Net lines should also avoid unnecessary bends if possible. Routing is generated automatically so you should move components to improve clarity.

If you need to rearrange pins to make the schematic neater, then you can, but make sure this doesn't comprimise usages of the components in other locations.

It's better for this task to tweak the schematic, check the new render and keep iterating around. Don't spend lots of time reasoning about what the optimal arrangemet will be. This action is not expensive

```
vibepcb_export_schematic({ filePath: "/absolute/path/to/schematic.vibesch" })
```

The tool returns the path to a temporary PNG file. Read that file to inspect the layout visually. Iterate on component positions until the schematic is clean and readable.

### Review

After each design session, change pace and act as a senior engineer doing a peer check. Try to find issues and discrepancies with the design. Go back around and fix them if necessary.

### Design logs

After finishing the design/review process, create a new numbered design log (`NNN_<topic>.md`) for each IC, key feature, or architectural decision. Each log should include:

- Key requirements / specifications
- Component selection (research, trade-offs)
- Ideal calculations (e.g., passive values)
- Realistic choices (e.g., standard resistor values)
- Re-calculations to quantify error vs. ideal
- Circuit implementation — how each part works
- PCB layout notes
- Further work and known issues

Try to avoid diagrams in your design logs, as they are unclear when rendered in ascii. Instead make sure your descriptions are clear and comprehensive.

---

## VibePCB File Format Reference

VibePCB uses three JSON-based file formats:

| Extension | Purpose |
|---|---|
| `.vibesch` | Schematic — component placement and net connections |
| `.vibecomp` | Component definition — symbol graphics, pins, and properties |
| `.vibeschtemplate` | Page template — paper size, border, and title block layout |

All coordinates inside `.vibesch` and `.vibecomp` use a **100 mil grid** (1 unit = 2.54 mm). Template files use **millimetres**.

---

## `.vibesch` — Schematic

The top-level key is `"schematic"`.

```json
{
  "schematic": {
    "template":   "<path to .vibeschtemplate>",
    "titleblock": { ... },
    "imports":    [ ... ],
    "components": [ ... ],
    "nets":       [ ... ]
  }
}
```

### `template`
*string, optional*

Relative path from the `.vibesch` file to the page template.

```json
"template": "../../templates/a4.vibeschtemplate"
```

If omitted, the schematic renders without a page border or title block.

---

### `titleblock`
*object, required*

| Field | Type | Description |
|---|---|---|
| `name` | string | Circuit / schematic title |
| `description` | string | One-line description |
| `version` | string | Revision string, e.g. `"1.0.0"` |
| `author` | string | Author name |
| `company` | string | Company or project name |

---

### `imports`
*array, required*

Declares which component definitions the schematic uses and gives each an alias.

```json
"imports": [
  { "path": "../components/ne555/ne555.vibecomp",       "as": "NE555"    },
  { "path": "../components/res_0805/res_0805.vibecomp", "as": "RES_0805" }
]
```

---

### `components`
*array, required*

Places instances of imported component definitions on the schematic.

```json
"components": [
  {
    "ref":      "U1",
    "extends":  "NE555",
    "position": { "x": 0, "y": 0 },
    "comment":  "1Hz astable oscillator"
  },
  {
    "ref":      "R1",
    "extends":  "RES_0805",
    "position": { "x": 20, "y": 8 },
    "rotation": 90,
    "comment":  "LED current limiter",
    "overrides": {
      "properties": { "value": "200R" }
    }
  }
]
```

| Field | Type | Description |
|---|---|---|
| `ref` | string | Reference designator, e.g. `"U1"`, `"R3"`, `"C2"` |
| `extends` | string | Alias from `imports` |
| `position` | `{x, y}` | Position in 100 mil grid units |
| `rotation` | `0 \| 90 \| 180 \| 270` | Clockwise rotation in degrees (default `0`) |
| `flipX` | boolean | Mirror across the Y axis (default `false`) |
| `flipY` | boolean | Mirror across the X axis (default `false`) |
| `comment` | string | Human-readable note (not rendered) |
| `overrides.properties` | object | Per-instance property overrides |

Flip is applied before rotation, so `flipX + rotation: 90` first mirrors then rotates clockwise. Wires are re-routed automatically to match the transformed pin positions.

---

### `nets`
*array, required*

Connects pins using `"REF.pin_number"` notation.

```json
"nets": [
  { "name": "VCC",      "pins": ["U1.8", "U1.4", "R2.1"], "style": "rail" },
  { "name": "GND",      "pins": ["U1.1", "C1.2", "D1.K"], "style": "gnd"  },
  { "name": "node_out", "pins": ["U1.3", "R1.1"] }
]
```

#### Net styles

| `style` | Rendering |
|---|---|
| *(omitted)* | Normal wire — routed automatically |
| `"rail"` | Power rail symbol at each pin; no wire |
| `"gnd"` | Ground symbol at each pin; no wire |
| `"label"` | Net label at each pin; no wire |

---

## `.vibecomp` — Component Definition

The top-level key is `"component"`.

```json
{
  "component": {
    "name":        "NE555 Timer",
    "description": "General-purpose single bipolar timer IC, DIP-8 / SOIC-8",
    "category":    "ic",
    "symbol":      "ne555",
    "footprint":   "Package_DIP:DIP-8_W7.62mm",
    "pins":        [ ... ],
    "graphics":    [ ... ],
    "properties":  { ... }
  }
}
```

### `pins`

```json
"pins": [
  { "number": 1, "name": "GND", "type": "power_in", "position": { "dx": -4, "dy": 3 } },
  { "number": 3, "name": "OUT", "type": "output",   "position": { "dx":  4, "dy": 1 } }
]
```

Positive `dx` → right, positive `dy` → up.

#### Pin types

| `type` | Meaning |
|---|---|
| `"input"` | Signal input |
| `"output"` | Signal output |
| `"bidirectional"` | Bidirectional signal |
| `"power_in"` | Power supply input (VCC, GND) |
| `"power_out"` | Power supply output |
| `"open_collector"` | Open-collector / open-drain output |
| `"passive"` | No defined direction (resistors, capacitors) |

---

### `graphics`
*array, optional*

Four primitive types (all coordinates in 100 mil grid units, relative to component origin):

| Type | Key fields |
|---|---|
| `line` | `x1, y1, x2, y2` |
| `rect` | `x, y` (top-left), `width, height` |
| `polygon` | `points: [[x,y], ...]` — auto-closed |
| `arrow` | `x1, y1, x2, y2` — arrowhead at (x2,y2) |

---

### `properties`

```json
"properties": {
  "value":   { "value": "NE555", "display": "shown"  },
  "package": { "value": "DIP-8", "display": "shown"  },
  "datasheet": { "value": "https://...", "display": "hidden" }
}
```

`"display": "shown"` renders as a label on the schematic. `"display": "hidden"` stores metadata only. The `display` flag cannot be overridden per-instance.

---

## `.vibeschtemplate` — Page Template

The top-level key is `"template"`. All dimensions in **millimetres**.

Key structure: `paper` (format, orientation, width_mm, height_mm) → `border` (margin_mm, line_weight_mm) → `titleblock` (position_mm, width_mm, height_mm, rows of cells).

Each cell's `source` field pulls from `schematic.titleblock.<field>` or `auto.date` / `auto.sheet_number`.

---

## Coordinate System Summary

| Context | Unit | Origin | +x | +y |
|---|---|---|---|---|
| `.vibecomp` pins & graphics | 100 mil (2.54 mm) | Component centre | Right | Up |
| `.vibesch` component positions | 100 mil (2.54 mm) | Page centre | Right | Up |
| `.vibeschtemplate` | mm | Top-left of page | Right | Down |
