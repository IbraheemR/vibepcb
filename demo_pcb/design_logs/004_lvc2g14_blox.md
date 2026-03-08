# 004 — SN74LVC2G14 Dual Schmitt-Trigger RC Oscillator 1 Hz LED Flasher

## Key Requirements

- Flash a red LED at approximately 1 Hz.
- Run from 5 V supply.
- Use a dual Schmitt-trigger inverter with **no unused gates**, addressing the main inefficiency of the 74HC14 design (design 003), which wastes four out of six gates.
- All passives 0805 SMD.

---

## Component Selection

The 74HC14 used in design 003 is a hex (6-gate) inverter in SOIC-14. Only two gates are needed for the oscillator and LED driver, leaving four gates idle. Per CMOS good practice, idle inputs must be tied to a rail to prevent oscillation; this adds four resistors (or net connections) and consumes board area.

The **SN74LVC2G14** (Texas Instruments) solves this directly: it is a dual (2-gate) Schmitt-trigger inverter in a SOT-23-6 package. With two gates and two needed, utilisation is 100%.

Key benefits over 74HC14:

| Property              | 74HC14 (design 003)     | SN74LVC2G14 (this design) |
|-----------------------|-------------------------|---------------------------|
| Gates                 | 6                       | 2                         |
| Gates used            | 2                       | 2                         |
| Unused gate handling  | 4 inputs tied to GND    | None required             |
| Package               | SOIC-14 (14 pins)       | SOT-23-6 (6 pins)         |
| Body area             | ~8.7 × 3.9 mm           | ~2.9 × 1.6 mm             |
| Supply range          | 2.0–6.0 V               | 1.65–5.5 V                |
| Max output current    | 25 mA                   | 32 mA                     |

An additional electrical advantage: the LVC2G14 thresholds at 5V are VT+ = 3.0 V and VT- = 2.0 V, which sum to Vcc. This symmetry property means the oscillator produces a **50% duty cycle** square wave, compared to the asymmetric 75%/25% produced by the 74HC14 at 5 V. The LED blinks evenly on and off rather than mostly-on with a brief off pulse.

The SN74LVC2G14 datasheet is stored at `components/sn74lvc2g14/sn74lvc2g14.pdf`.

---

## Oscillator Theory

Identical RC Schmitt relaxation oscillator topology as design 003. One inverter (gate 1) feeds its output back to its input through resistor R1; capacitor C1 sits between the input node and GND.

Period:

    T = R * C * [ln((Vcc - VT-) / (Vcc - VT+)) + ln(VT+ / VT-)]
      = R * C * k

Because VT+ + VT- = Vcc (= 5.0 V), we have (Vcc - VT-) = VT+ and (Vcc - VT+) = VT-, so:

    k = ln(VT+ / VT-) + ln(VT+ / VT-) = 2 * ln(VT+ / VT-)

Both half-cycles are equal, giving 50% duty cycle.

---

## Ideal Calculations

With Vcc = 5 V, VT+ = 3.0 V, VT- = 2.0 V:

    k = 2 * ln(3.0 / 2.0) = 2 * 0.4055 = 0.8109

For f = 1 Hz:

    R * C = 1 / (1.0 * 0.8109) = 1.233 s

Choosing C1 = 10 µF:

    R = 1.233 / 10×10⁻⁶ = 123.3 kΩ

---

## Realistic Choices

Nearest E24 standard value: **R1 = 120 kΩ**.

Re-calculation with R = 120 kΩ, C = 10 µF:

    T = 0.8109 * 120×10³ * 10×10⁻⁶ = 0.973 s
    f = 1 / 0.973 = 1.028 Hz     (error: +2.8%)

    t_charge = t_discharge = 486.6 ms  (equal, confirming 50% duty cycle)

The next standard value is 130 kΩ, which gives 0.949 Hz (−5.1%); 120 kΩ is closer.

---

## LED Drive

Gate 2 is an inverter. Gate 1 output is HIGH while the capacitor charges (486.6 ms), so gate 2 output is LOW during that half. During the discharge half, gate 1 output is LOW and gate 2 output is HIGH, turning the LED on. Net result: LED on for 50% of each 973 ms cycle, turning on and off once per second.

    I_LED = (Vcc - Vf) / R2 = (5.0 - 2.0) / 200 = 15 mA

This is within the SN74LVC2G14 32 mA output current maximum.

---

## Circuit Implementation

Gate 1 (pins 1A = 1, 1Y = 2) — RC oscillator:
- R1 (120 kΩ) bridges the output (pin 2) to the input (pin 1) as the feedback/charging resistor.
- C1 (10 µF) sits between the input node (pin 1) and GND.

Gate 2 (pins 2A = 4, 2Y = 5) — LED driver:
- Input (pin 4) receives the oscillator output signal. A net label "node_osc" is used on the schematic to avoid routing a wire from the right side of the IC (pin 2) to the left side (pin 4) across the component body.
- Output (pin 5) connects through R2 (200 Ω) to the LED anode. LED cathode to GND.

Decoupling: C2 = 100 nF ceramic between VCC (pin 6) and GND (pin 3).

No unused gate housekeeping is required since both gates are in use.

---

## PCB Layout Notes

- The SOT-23-6 package is very small (2.9 × 1.6 mm pad pattern). All surrounding passives can fit within a 10 × 10 mm area.
- Place C2 within 2 mm of U1 pins 6 and 3.
- Place C1 close to U1 pin 1 to keep the high-impedance timing node short.
- R1 arches over the IC in the schematic; physically it can be placed on the opposite side of the PCB or as a short trace looping from pin 2 to pin 1.

---

## Comparison with All Designs

| Aspect             | NE555 (001)     | LTC6992 (002)  | 74HC14 (003)      | LVC2G14 (this)   |
|--------------------|-----------------|----------------|-------------------|------------------|
| Output frequency   | ~1 Hz           | ~1 kHz PWM     | ~1 Hz             | ~1 Hz            |
| Duty cycle         | ~52%            | Adjustable     | ~25%/75% asym.    | **50% (exact)**  |
| Gate utilisation   | N/A             | N/A            | 2 / 6 (33%)       | **2 / 2 (100%)** |
| Package            | DIP-8           | SOT-23-6       | SOIC-14           | **SOT-23-6**     |
| Supply voltage     | 4.5–16 V        | 2.25–5.5 V     | 2.0–6.0 V         | 1.65–5.5 V       |
| Frequency accuracy | ±5–10%          | ±1.7%          | ±5–15%            | ±5–15% (RC)      |
| Passive count      | 6               | 8              | 5 + 4 GND ties    | **5**            |
| Notes              | High voltage OK | PWM/dimming    | Large IC, waste   | Smallest, clean  |

---

## Peer Review — Known Issues and Further Work

- **Threshold spread**: Like the 74HC14, the LVC2G14 has wide process spread on VT+ and VT-. The 50% duty cycle is a property of the typical values; in the worst case over process/voltage/temperature, the thresholds may not sum exactly to Vcc, giving slight asymmetry. Frequency accuracy remains ±5–15% — acceptable for visual blinking.
- **Startup**: On power-up, if Vc starts at exactly a threshold voltage the circuit could theoretically lock up; in practice thermal noise always drives it into oscillation within microseconds.
- **C1 leakage**: A 10 µF ceramic capacitor has significant DC leakage at elevated temperatures, which will shift the effective timing. An electrolytic can be substituted for better stability, but requires attention to polarity (positive terminal to the resistor/input node side, which is always positive relative to GND in this circuit).
- **LVC output voltage compliance**: The LVC2G14 output swings to within ~0.1 V of the rails (strong driver). At 5 V with a 200 Ω series resistor and 2.0 V LED forward voltage, the current is 15 mA — a safe, bright drive level.
