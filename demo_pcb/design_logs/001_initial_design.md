# Design Log 001 — NE555 1Hz LED Flasher

## Overview

This project is a simple 5V circuit that uses a NE555 timer in astable mode to flash a red LED at approximately 1Hz.

---

## What Was Built

### Component Library

Three component definition files (`.vibecomp`) live in `components/`:

| File | Description |
|------|-------------|
| `res_0805.vibecomp` | Generic SMD resistor, 0805 package |
| `red_led.vibecomp` | Standard SMD red LED, 0805 package |
| `ne555.vibecomp` | NE555 bipolar timer IC, DIP-8 |
| `cap_0805.vibecomp` | Generic SMD capacitor, 0805 package |

Each component defines:
- **pins** — number, name, electrical type, and symbol position
- **graphics** — lines, rects, polygons, and arrows that draw the schematic symbol
- **properties** — key/value pairs, each with a `display` flag (`"shown"` or `"hidden"`) and a `position` on the schematic grid

Properties marked `"shown"` appear as labels next to the symbol on the schematic (e.g. value, package). Properties marked `"hidden"` are stored as metadata but not rendered (e.g. voltage ratings, datasheet URL).

---

## Schematic — `schematics/top_level.vibesch`

### Circuit Description

The NE555 is wired in **astable (free-running oscillator) mode**. It continuously charges and discharges a timing capacitor through two resistors, producing a square wave on its OUT pin. That square wave drives a red LED through a current-limiting resistor.

### Timing Calculation

```
f = 1.44 / ((Ra + 2 * Rb) * C)

Ra = R2 = 4.7kΩ
Rb = R3 = 68kΩ
C  = C1 = 10µF

f = 1.44 / ((4,700 + 136,000) * 0.000010)
  = 1.44 / 1.407
  ≈ 1.02 Hz
```

Duty cycle ≈ (Ra + Rb) / (Ra + 2·Rb) = 72.7 / 140.7 ≈ **52%** (slightly above 50%)

### Component List (Bill of Materials)

| Ref | Value | Package | Purpose |
|-----|-------|---------|---------|
| U1  | NE555 | DIP-8 | Astable oscillator |
| R2  | 4.7kΩ | 0805 | Ra — upper timing resistor (charges C1) |
| R3  | 68kΩ  | 0805 | Rb — lower timing resistor (discharges C1 via DIS) |
| R1  | 200Ω  | 0805 | LED current limiter |
| C1  | 10µF, 25V | 0805 | Timing capacitor |
| C2  | 10nF, 25V | 0805 | CTRL pin bypass (noise suppression) |
| D1  | Red LED | 0805 | Visual indicator |

### Net List

| Net | Connected Pins | Description |
|-----|---------------|-------------|
| `VCC` | U1.VCC, U1.RESET, R2.1 | 5V supply; RESET tied high to enable |
| `node_dis` | U1.DIS, R2.2, R3.1 | Junction between Ra and Rb at discharge pin |
| `node_timing` | U1.TRIG, U1.THR, R3.2, C1.1 | Capacitor top plate; sets trigger/threshold |
| `node_ctrl` | U1.CTRL, C2.1 | Control voltage pin with bypass cap |
| `node_out` | U1.OUT, R1.1 | Square wave output driving LED chain |
| `node_A` | R1.2, D1.A | LED anode after current limiter |
| `GND` | U1.GND, C1.2, C2.2, D1.K | Common ground |

### How It Works Step by Step

1. **Power-on:** C1 is discharged. TRIG (pin 2) is low, which sets the internal flip-flop — OUT goes high.
2. **Charge phase:** Current flows VCC → R2 → R3 → C1. OUT stays high, LED is ON.
3. **Upper threshold:** When C1 reaches 2/3 VCC, the THR comparator resets the flip-flop — OUT goes low.
4. **Discharge phase:** C1 discharges through R3 → DIS (pin 7) to GND. LED is OFF.
5. **Lower threshold:** When C1 falls to 1/3 VCC, the TRIG comparator sets the flip-flop again — OUT goes high. Cycle repeats from step 2.
6. **C2 (10nF on CTRL):** Bypasses the internal 2/3 VCC voltage divider reference to ground, filtering supply noise for stable timing.
