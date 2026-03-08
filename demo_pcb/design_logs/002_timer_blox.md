# Design Log 002 — TimerBlox PWM LED Dimmer

**Date:** 2026-03-08
**Schematic:** `schematics/timer_blox.vibesch`
**IC:** LTC6992-1 (Analog Devices TimerBlox family)
**Datasheet:** `components/ltc6992-1/LTC6992-1-6992-2-6992-3-6992-4.pdf`

---

## Overview

This design replaces the NE555 astable oscillator from `top_level.vibesch` with the
**LTC6992-1**, a precision silicon PWM oscillator from Analog Devices' TimerBlox family.

Rather than a simple on/off blink, this design produces a **~1kHz PWM signal** driving a
red LED at an adjustable duty cycle. The duty cycle is set by an analog voltage at the MOD
pin — making it suitable as a dimmable LED driver or as the basis of a PWM servo loop.

---

## IC: LTC6992-1

| Parameter              | Value                          |
|------------------------|--------------------------------|
| Package                | SOT-23-6 (S6 / TSOT-23)        |
| Supply voltage (V+)    | 2.25 V to 5.5 V                |
| Supply current (typ)   | 115 µA at 100 kHz (NDIV ≥ 16) |
| Output driver          | CMOS push-pull, ±20 mA         |
| Frequency range        | 3.81 Hz to 1 MHz               |
| Frequency accuracy     | ±1.7% max                      |
| Duty cycle range       | 0% to 100% (LTC6992-1 variant) |
| PWM DC accuracy        | ±3.7% max                      |

### Pin Configuration (S6 TSOT-23, top view)

| Pin | Name | Function                                          |
|-----|------|---------------------------------------------------|
| 1   | MOD  | Analog duty-cycle modulation input (0 V to VSET)  |
| 2   | GND  | Ground                                            |
| 3   | SET  | Frequency-set resistor (RSET from SET to GND)     |
| 4   | DIV  | Frequency divider select (resistor divider to V+) |
| 5   | V+   | Positive supply                                   |
| 6   | OUT  | Square-wave / PWM output                         |

---

## Frequency Calculation

The output frequency is:

```
f_OUT = (1 MHz / NDIV) × (50 kΩ / RSET)
```

Where NDIV is set by the DIV pin voltage:

```
VDIV / V+ = (DIVCODE + 0.5) / 16
```

NDIV values and corresponding DIVCODEs (powers of 4):

| DIVCODE | NDIV  |
|---------|-------|
| 0       | 1     |
| 2       | 4     |
| 4       | 16    |
| 6       | 64    |
| 8       | 256   |
| 10      | 1024  |
| 12      | 4096  |
| 14      | 16384 |

**This design targets NDIV = 256 (DIVCODE = 8), RSET = 200 kΩ:**

```
f_OUT = (1,000,000 / 256) × (50,000 / 200,000)
      = 3906.25 × 0.25
      = 976.6 Hz  ≈ 1 kHz
```

---

## Duty Cycle Control

The duty cycle is set by the voltage at the MOD pin (VMOD), relative to the internal
reference VSET ≈ 1.00 V:

```
Duty Cycle = VMOD / VSET × 100%  (for LTC6992-1, 0% to 100%)
```

A fixed resistor divider from V+ to GND sets VMOD ≈ 0.5 V for 50% duty cycle:

- **R4 = 56 kΩ** (V+ to MOD node)
- **R5 = 10 kΩ** (MOD node to GND)

```
VMOD = V+ × R5 / (R4 + R5) = 3.3 × 10k / (56k + 10k) = 3.3 × 0.1515 = 0.50 V
Duty Cycle = 0.50 V / 1.00 V = 50%
```

> To make duty cycle adjustable, replace R4+R5 with a 100 kΩ potentiometer.

---

## DIV Pin Resistor Divider

For DIVCODE = 8 (NDIV = 256):

```
VDIV / V+ = (8 + 0.5) / 16 = 0.53125
```

Using standard 1% values:
- **R2 = 470 kΩ** (V+ to DIV node)
- **R3 = 560 kΩ** (DIV node to GND)

```
VDIV / V+ = 560k / (470k + 560k) = 560k / 1030k = 0.544
```

This gives DIVCODE ≈ 0.544 × 16 − 0.5 = 8.2 → selects DIVCODE 8, NDIV = 256. ✓

---

## Bill of Materials

| Ref | Value  | Package  | Purpose                                |
|-----|--------|----------|----------------------------------------|
| U1  | LTC6992-1 | SOT-23-6 | PWM oscillator IC                  |
| R1  | 200 kΩ | 0805     | RSET — sets master oscillator frequency |
| R2  | 470 kΩ | 0805     | DIV divider upper — selects NDIV=256   |
| R3  | 560 kΩ | 0805     | DIV divider lower — selects NDIV=256   |
| R4  | 56 kΩ  | 0805     | MOD divider upper — sets 50% duty cycle |
| R5  | 10 kΩ  | 0805     | MOD divider lower — sets 50% duty cycle |
| C1  | 100 nF | 0805     | V+ supply bypass capacitor             |
| R6  | 150 Ω  | 0805     | LED current limiter                    |
| D1  | Red LED | 0805    | Status indicator driven by PWM output  |

---

## LED Current

```
I_LED = (V+ − Vf) / R6 × Duty_Cycle
      = (3.3 V − 2.0 V) / 150 Ω × 0.50
      = 8.67 mA × 0.50
      = 4.3 mA average  (8.7 mA peak)
```

Within LED's 20 mA max forward current rating. ✓

---

## Netlist Summary

| Net        | Pins                                     | Description                    |
|------------|------------------------------------------|--------------------------------|
| VCC        | U1.5, C1.1, R2.1, R4.1                  | 3.3 V supply rail              |
| node_set   | U1.3, R1.1                               | RSET connection to SET pin     |
| node_div   | U1.4, R2.2, R3.1                         | DIV pin voltage (selects NDIV) |
| node_mod   | U1.1, R4.2, R5.1                         | MOD pin voltage (sets DC)      |
| node_out   | U1.6, R6.1                               | PWM output to LED chain        |
| node_A     | R6.2, D1.A                               | LED anode after current limiter|
| GND        | U1.2, R1.2, R3.2, R5.2, C1.2, D1.K      | Ground                         |

---

## Comparison with NE555 Design (Log 001)

| Aspect          | NE555 (Log 001)         | LTC6992-1 (Log 002)         |
|-----------------|-------------------------|-----------------------------|
| Output type     | Square wave (astable)   | PWM with analog control     |
| Frequency       | ~1 Hz                   | ~1 kHz                      |
| Duty cycle ctrl | Fixed by Ra/Rb          | Analog voltage (0–1 V)      |
| Accuracy        | ±5–10% (RC tolerance)   | ±1.7% max                   |
| Supply          | 4.5–16 V                | 2.25–5.5 V                  |
| Package         | DIP-8 / SOIC-8          | SOT-23-6 (tiny SMD)         |
| Supply current  | ~3–10 mA                | ~115 µA                     |
| Dim capability  | No                      | Yes (0–100% PWM)            |

---

## Project Structure Change (Log 002)

Components were refactored from a flat `components/` folder into per-component subfolders,
each containing the `.vibecomp` definition and (where available) the datasheet PDF:

```
components/
  ne555/          ne555.vibecomp
  cap_0805/       cap_0805.vibecomp
  res_0805/       res_0805.vibecomp
  red_led/        red_led.vibecomp
  ltc6992-1/      ltc6992-1.vibecomp
                  LTC6992-1-6992-2-6992-3-6992-4.pdf
```

All schematic import paths have been updated accordingly.
