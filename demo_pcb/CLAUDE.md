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

### PCB layout

**Do not create a PCB layout unless explicitly asked.** PCB layout is a separate task from schematic design. Only proceed with this section when prompted.

After the schematic is complete, create a `.vibepcb` file in `pcb/` that references the schematic. The PCB layout workflow mirrors the schematic workflow — edit, export, inspect, iterate:

1. **Set up the board** — choose `width_mm` and `height_mm` to fit your components with some margin. Origin is bottom-left.

2. **Place components** — add a `placements` entry for every ref designator in the schematic. Start with a rough arrangement: ICs in the centre, decoupling caps near their associated IC, connectors at board edges. Use `rotation` (0/90/180/270) to align pads with trace directions.

3. **Route traces** — add `traces` entries (from/to + width_mm) to connect pads according to the netlist. Use wider traces (0.4–0.5mm) for power nets (VCC, GND) and thinner traces (0.2–0.25mm) for signals. Add `rects` for bus bars or large copper areas.

4. **Export and inspect** — use the `vibepcb_export_pcb` tool to export as PNG and visually check the result:

```
vibepcb_export_pcb({ filePath: "/absolute/path/to/pcb.vibepcb" })
```

5. **Iterate** — adjust placements and traces until:
   - No traces overlap or cross (this is a single-layer board — wirebonding handles jumps, but minimise them)
   - Pads connect cleanly to traces
   - Components don't overlap each other
   - Power traces are short and wide
   - There is adequate clearance between copper features

Keep iterating quickly — tweak positions, re-export, check. Don't over-think placement before seeing the render.

### To export and inspect schematics and PCBs, use the following procedure strictly
1. Identify a few issues
2. choose the worst one
3. make a change to source file
4. re-render and check the output file with the mcp tool
5. repeat for the next three issues
6. continue until statified

Pay attention to overlapping netlines/trace, shorts, messy wiring. Do not consider optimisation or routing strategy - prioritise making fast and quick edits and assessing the outcome.

Add jumper wires if necessary. You might get to a oint where issues cannot be solved - if this is that case, then stop and tell me

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

VibePCB uses four JSON-based file formats:

| Extension | Purpose |
|---|---|
| `.vibesch` | Schematic — component placement and net connections |
| `.vibecomp` | Component definition — symbol graphics, pins, properties, and footprint |
| `.vibeschtemplate` | Page template — paper size, border, and title block layout |
| `.vibepcb` | PCB layout — board outline, component placement, and routing |

All coordinates inside `.vibesch` and `.vibecomp` use a **100 mil grid** (1 unit = 2.54 mm). Template and PCB files use **millimetres**.

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

## `.vibepcb` — PCB Layout

The top-level key is `"pcb"`. All dimensions in **millimetres**. Origin is at the **bottom-left** corner of the board.

```json
{
  "pcb": {
    "schematic":  "<path to .vibesch>",
    "titleblock": { ... },
    "board":      { ... },
    "placements": [ ... ],
    "traces":     [ ... ],
    "rects":      [ ... ]
  }
}
```

### Constraints

- **Single layer only** — no vias, no layer switching. Use `jumpers` for connections that must cross other traces. Jumpers are placed by a wirebonding machine.
- **Rectangular boards only** — defined by `width_mm` and `height_mm`.
- **Footprints are defined in `.vibecomp` files** — placements only need `ref`, `position`, and `rotation`.
- **No zones or copper pours.**

---

### `schematic`
*string, required*

Relative path from the `.vibepcb` file to the schematic it implements.

```json
"schematic": "../schematics/top_level.vibesch"
```

---

### `board`
*object, required*

```json
"board": {
  "width_mm": 30,
  "height_mm": 25
}
```

Rectangular board. Origin (0, 0) is the **bottom-left** corner.

---

### `placements`
*array, required*

Places component footprints on the board. Footprint geometry comes from the `.vibecomp` file (resolved via the linked schematic's imports).

```json
"placements": [
  { "ref": "U1", "position": { "x": 12.0, "y": 12.5 }, "rotation": 0 },
  { "ref": "R1", "position": { "x": 22.0, "y": 8.0 },  "rotation": 90 }
]
```

| Field | Type | Description |
|---|---|---|
| `ref` | string | Reference designator — must match a component in the schematic |
| `position` | `{x, y}` | Centre of footprint in mm from board origin (bottom-left) |
| `rotation` | `0 \| 90 \| 180 \| 270` | Clockwise rotation in degrees (default `0`) |

---

### `traces`
*array, optional*

Point-to-point copper traces.

```json
"traces": [
  {
    "net": "VCC",
    "width_mm": 0.4,
    "from": { "x": 8.19, "y": 5.0 },
    "to":   { "x": 15.81, "y": 5.0 }
  }
]
```

| Field | Type | Description |
|---|---|---|
| `net` | string | Net name (must match a net in the schematic) |
| `width_mm` | number | Trace width |
| `from` | `{x, y}` | Start point in mm |
| `to` | `{x, y}` | End point in mm |

---

### `rects`
*array, optional*

Filled copper rectangles (e.g. pads, bus bars, ground planes).

```json
"rects": [
  {
    "net": "GND",
    "from": { "x": 0.5, "y": 0.5 },
    "to":   { "x": 29.5, "y": 2.0 }
  }
]
```

| Field | Type | Description |
|---|---|---|
| `net` | string | Net name |
| `from` | `{x, y}` | One corner in mm |
| `to` | `{x, y}` | Opposite corner in mm |

---

### `jumpers`
*array, optional*

Jumper wires placed by a wirebonding machine. These connect two points on the board where a single-layer trace cannot reach (e.g. crossing over another trace). Jumpers can be positioned at any angle. Each jumper is rendered as a grey dashed wire with circular landing pads at both endpoints.

```json
"jumpers": [
  {
    "net": "VCC",
    "from": { "x": 5.0, "y": 10.0 },
    "to":   { "x": 20.0, "y": 15.0 },
    "pad_diameter_mm": 0.8
  }
]
```

| Field | Type | Description |
|---|---|---|
| `net` | string | Net name (must match a net in the schematic) |
| `from` | `{x, y}` | Start point in mm (landing pad centre) |
| `to` | `{x, y}` | End point in mm (landing pad centre) |
| `pad_diameter_mm` | number | Landing pad diameter (default `0.8`) |

Jumpers are drawn above the copper layer but below component overlays, so they visually sit on top of traces. Use jumpers sparingly — they add manufacturing cost. Prefer rearranging component placement and trace routing to minimise the number of jumpers needed.

---

## Coordinate System Summary

| Context | Unit | Origin | +x | +y |
|---|---|---|---|---|
| `.vibecomp` pins & graphics | 100 mil (2.54 mm) | Component centre | Right | Up |
| `.vibesch` component positions | 100 mil (2.54 mm) | Page centre | Right | Up |
| `.vibeschtemplate` | mm | Top-left of page | Right | Down |
| `.vibepcb` board layout | mm | Bottom-left of board | Right | Up |
