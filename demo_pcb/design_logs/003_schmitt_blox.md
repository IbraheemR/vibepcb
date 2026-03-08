# 003 — 74HC14 Schmitt-Trigger RC Oscillator 1 Hz LED Flasher

## Key Requirements

- Flash a red LED at approximately 1 Hz (±10% acceptable given RC tolerances).
- Run from 5 V supply (same rail as the NE555 design).
- Use the existing 74HC14 component (already in library) as an alternative to the 555 timer approach.
- All passives to be 0805 SMD.

---

## Component Selection

The 74HC14 is a hex inverting Schmitt-trigger buffer (SOIC-14, TI SN74HC14 or equivalent). It contains six independent inverters, each with defined positive (VT+) and negative (VT-) input thresholds. The hysteresis between the two thresholds is the mechanism that enables a simple RC network to produce a stable square-wave oscillation — no op-amp, no dedicated timer IC needed.

Key parameters at Vcc = 4.5 V (closest tabulated supply to 5 V):
- VT+ (positive threshold, typical) = 1.6 V
- VT- (negative threshold, typical) = 0.9 V
- Hysteresis = 0.7 V
- Output current (max) = ±25 mA — sufficient to drive an LED directly through a series resistor.

The chip contains six gates, so only two are used: one for the oscillator and one as an output buffer/inverter for the LED.

---

## Oscillator Theory

A single inverter with an RC feedback network forms the oscillator. The output is fed back to the input through a resistor R1, and a capacitor C1 sits between the input node and GND. The circuit self-oscillates because:

When the output is HIGH (Vcc): C1 charges toward Vcc through R1. Once the input voltage rises to VT+, the output snaps LOW.

When the output is LOW (0 V): C1 discharges toward 0 V through R1. Once the input voltage falls to VT-, the output snaps HIGH.

Each half-cycle is an exponential charge or discharge:

Charge time (output HIGH, capacitor going from VT- to VT+):

    t1 = R · C · ln((Vcc - VT-) / (Vcc - VT+))

Discharge time (output LOW, capacitor going from VT+ to VT-):

    t2 = R · C · ln(VT+ / VT-)

Total period:

    T = t1 + t2 = R · C · k
    where k = ln((Vcc - VT-) / (Vcc - VT+)) + ln(VT+ / VT-)

---

## Ideal Calculations

With Vcc = 5 V, VT+ = 1.6 V, VT- = 0.9 V:

    k = ln((5.0 - 0.9) / (5.0 - 1.6)) + ln(1.6 / 0.9)
      = ln(1.206) + ln(1.778)
      = 0.1871 + 0.5754
      = 0.7626

For f = 1 Hz:

    R · C = 1 / (f · k) = 1 / (1.0 × 0.7626) = 1.311 s

Choosing C1 = 10 µF (a standard value, same as used in the NE555 design):

    R = 1.311 / 10×10⁻⁶ = 131.1 kΩ

---

## Realistic Component Choices

Nearest E24 standard value: **R1 = 130 kΩ**

Re-calculation with R = 130 kΩ, C = 10 µF:

    T = 0.7626 × 130×10³ × 10×10⁻⁶ = 0.991 s
    f = 1 / 0.991 = 1.009 Hz    (error: +0.9%)

    t1 (output HIGH) = 243 ms
    t2 (output LOW)  = 748 ms
    Duty cycle of gate 1 output HIGH = 24.5%

The asymmetric duty cycle arises because VT+ and VT- are not symmetric around Vcc/2. The discharge time (capacitor from 1.6 V to 0.9 V, relatively small voltage swing) is longer than the charge time (from 0.9 V toward 5 V, large delta). This is normal for the 74HC14 with these threshold ratios.

The LED (driven through the inverting gate 2) is therefore ON for approximately 75.5% of each cycle — the LED is on for most of the period and off briefly. This gives a "blink off" style appearance rather than a 50/50 flash. For a more symmetric flash, a second RC stage or a different gate arrangement would be needed, but the 1 Hz cadence is met.

---

## LED Drive

Gate 2 output drives the LED. When gate 2 output is HIGH:

    I_LED = (Vcc - Vf) / R2 = (5.0 - 2.0) / 200 = 15 mA

This is within the 25 mA maximum for the 74HC14 output stage. A bypass capacitor C2 (100 nF) is placed close to the VCC pin.

---

## Circuit Implementation

Gate 1 (pins 1A, 1Y) is the RC oscillator:
- R1 (130 kΩ) bridges the output (pin 2) back to the input (pin 1). This is the current-limiting feedback path that controls charge/discharge rate.
- C1 (10 µF) sits between the input node (pin 1) and GND. It is the timing element.

Gate 2 (pins 2A, 2Y) is the LED driver:
- Its input (pin 3) is connected to the oscillator output (pin 2). A net label "node_osc" is used in the schematic to avoid routing a wire across the IC body.
- Its output (pin 4) connects through R2 (200 Ω) to the LED anode. LED cathode connects to GND.

Unused gates (3, 4, 5, 6 — input pins 5, 9, 11, 13) all have their inputs tied to GND. This is the recommended practice to avoid undefined logic states and reduce susceptibility to noise-induced oscillation on floating inputs. Output pins of unused gates are left unconnected.

Decoupling: C2 = 100 nF ceramic placed between VCC (pin 14) and GND (pin 7) to suppress supply transients caused by the switching output stages.

---

## PCB Layout Notes

- Place C1 directly adjacent to pin 1 of U1 to minimise the input node stub length, reducing susceptibility to noise pickup on the high-impedance timing node.
- Place C2 as close as possible to U1 pins 14 and 7 (VCC and GND), ideally within 2 mm.
- The timing node (U1 pin 1 / R1 / C1) is high-impedance; keep it short and away from switching signals.
- R1 sits above the IC body in the schematic; route it as a short arc rather than a long detour.
- The LED and its series resistor (R2, D1) can be placed further from the IC with no performance impact.

---

## Comparison with Existing Designs

| Aspect               | NE555 (design 001)           | 74HC14 Schmitt (this design)         | LTC6992-1 (design 002)       |
|----------------------|------------------------------|--------------------------------------|------------------------------|
| Output frequency     | ~1 Hz                        | ~1 Hz                                | ~1 kHz PWM                   |
| Duty cycle           | ~52% (near symmetric)        | ~25% gate HIGH / 75% LED ON          | Adjustable 0–100%            |
| Oscillator core      | 555 internal comparators     | Schmitt hysteresis + RC              | Silicon oscillator           |
| Component count      | 7                            | 5 (+ 4 resistors tying unused gates) | 9                            |
| Package              | DIP-8                        | SOIC-14                              | SOT-23-6                     |
| Frequency accuracy   | ±5–10% (RC + 555 thresholds) | ±5–15% (RC + threshold spread)       | ±1.7%                        |
| Supply voltage       | 4.5–16 V                     | 2.0–6.0 V                            | 2.25–5.5 V                   |
| Supply current       | 3–10 mA                      | ~2 mA (mostly LED current)           | ~115 µA + LED                |

---

## Further Work and Known Issues

- The 74HC14 threshold voltages have wide process spread (e.g. at 4.5 V: VT+ min = 0.9 V, max = 3.15 V per datasheet). Actual frequency could vary by ±30–40% in the worst case over temperature and voltage. For a visual blinker this is acceptable, but not suitable for timing-critical applications.
- The asymmetric 25%/75% duty cycle may be aesthetically undesirable. To get closer to 50/50, use two cross-coupled inverters with separate RC networks, or add a second capacitor.
- With C1 = 10 µF and R1 = 130 kΩ, the timing node slew rate is slow. The input must not be driven by another signal simultaneously; treat it as a dedicated oscillator gate.
- The 74HC14 in SOIC-14 brings five unused gates. If board space is at a premium, the unused gates could instead buffer other signals (e.g., a pushbutton input) to make use of all six.
