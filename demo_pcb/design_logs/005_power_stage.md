# Design Log 005 — Three-Phase Inverter Power Stage

## Overview

Power stage for a three-phase two-level voltage-source inverter. The design targets 600V DC bus voltage and 50Arms thermal design current (TDC) per output phase, suitable for driving AC induction or permanent magnet motors in the ~20-25kW range.

---

## Key Requirements

| Parameter | Value |
|-----------|-------|
| DC bus voltage | 600V |
| Output current (TDC) | 50A RMS per phase |
| Topology | Three-phase, two-level, six-switch |
| Assumed switching frequency | 10kHz |
| Assumed modulation index | 0.9 |
| Assumed power factor | 0.85 |

---

## Component Selection

### IGBT — Infineon IKW75N120CH3

The primary switching devices are discrete IGBTs with integrated anti-parallel freewheeling diodes. At 600V bus, 1200V-rated devices are required (2x voltage derating to accommodate inductive overshoot and transient spikes).

The IKW75N120CH3 was selected from Infineon's TrenchStop IGBT3 family:

| Parameter | Value |
|-----------|-------|
| V_CE(max) | 1200V |
| I_C (continuous, 100C case) | 75A |
| V_CE(sat) typ | 1.65V |
| Package | TO-247-3 |
| Integrated diode | Yes (fast recovery) |

The 75A continuous rating at 100C case temperature provides adequate margin above the 50A TDC. The peak current capability (~150A, 1ms) accommodates short-duration overloads during motor starting or transient events. The integrated anti-parallel diode simplifies the design by eliminating the need for external freewheeling diodes.

Trade-offs considered:
- SiC MOSFETs (e.g. Wolfspeed C3M series) would offer lower switching losses and higher efficiency at elevated switching frequencies, but at significantly higher cost per device. For a 10kHz switching frequency application, IGBTs remain cost-effective.
- IGBT modules (e.g. Infineon EconoPACK) integrate a full half-bridge or six-pack in one package with optimised thermal and parasitic performance, but this design uses discrete TO-247 devices for flexibility and ease of prototyping.

### Gate Resistors — 10 Ohm, 0805

Each IGBT has a series gate resistor to limit gate current and control dv/dt during switching transitions. The 10 Ohm value is a standard starting point for the IKW75N120CH3.

Gate drive power dissipation: P = Q_g x V_GE x f_sw = 270nC x 15V x 10kHz = 0.04W. This is well within the 0.125W rating of an 0805 SMD resistor.

In a refined design, split gate resistors (separate turn-on and turn-off paths with diode steering) would allow independent control of turn-on dv/dt (EMI) and turn-off di/dt (overshoot). This is noted as further work.

### DC Link Capacitors — 2x 100uF, 900V Film

The DC link capacitors serve two functions: they supply the high-frequency switching ripple current and they maintain bus voltage stability during transient load changes.

Sizing was performed using the calculator in `calculators/005_dclink_sizing.py`, which implements the Kolar formula for DC link RMS ripple current in a three-phase SPWM inverter.

Key results:

| Parameter | Value |
|-----------|-------|
| RMS ripple current | 28.9A |
| Peak ripple current | 40.9A |
| Minimum capacitance (2% Vpp ripple) | 108.4uF |
| Design capacitance (1.5x margin) | 162.6uF |
| Selected total | 200uF (2x 100uF) |

EPCOS/TDK B32778 series polypropylene film capacitors were chosen for their low ESR (~3 mOhm) and low ESL, which is critical for minimising voltage spikes at switching transitions. The 900V DC rating provides 1.5x derating against the 600V bus.

In a production design, additional smaller film or MLCC capacitors (e.g. 1-4.7uF, 630V+) would be placed physically close to each half-bridge leg for high-frequency decoupling of the commutation loop. The two 100uF bulk caps shown are the primary DC link energy store.

### NTC Thermistors — 10k at 25C

Three NTC thermistors (one per half-bridge leg) are placed on the heatsink for temperature monitoring. These connect via TEMP_U, TEMP_V, TEMP_W net labels to the control system, which reads them using a voltage divider with a pullup resistor on the controller board.

The 10k NTC with B=3435K is a standard choice providing good sensitivity in the 25-150C range typical for IGBT heatsink monitoring.

---

## Circuit Implementation

### Three-Phase Bridge

The power stage is a standard six-switch two-level voltage-source inverter topology. Each output phase consists of a half-bridge (two IGBTs in series between DC+ and DC-). The midpoint of each half-bridge forms the phase output:

- Phase U: Q1 (high-side) and Q2 (low-side), output at PHASE_U
- Phase V: Q3 (high-side) and Q4 (low-side), output at PHASE_V
- Phase W: Q5 (high-side) and Q6 (low-side), output at PHASE_W

In each half-bridge, the high-side IGBT has its collector connected to DC+ and emitter connected to the phase output. The low-side IGBT has its collector connected to the phase output and emitter connected to DC-. The integrated anti-parallel diodes in each IGBT provide the freewheeling current path required during dead-time intervals and for reactive power flow.

### Gate Drive Interface

Each IGBT gate is driven through a 10 Ohm series resistor. The gate drive signals (GATE_UH, GATE_UL, GATE_VH, GATE_VL, GATE_WH, GATE_WL) are brought out as net labels for connection to a separate gate driver schematic sheet. The gate driver circuit (not part of this power stage schematic) must provide isolated gate drive with appropriate dead-time insertion to prevent shoot-through.

### DC Link

Two 100uF/900V polypropylene film capacitors are connected in parallel between DC+ and DC-. These provide the bulk energy storage and ripple current handling for the switching stage. In the PCB layout, these should be placed as close as physically possible to the IGBT half-bridges to minimise the parasitic inductance of the commutation loop.

### Temperature Monitoring

Three NTC thermistors are mounted on or near the heatsink, one per half-bridge leg. Each thermistor has one terminal connected to a TEMP_x net label (for ADC readout on the controller) and the other to GND. The controller board provides the pullup resistor and ADC interface.

---

## PCB Layout Notes

- The DC link capacitors must be placed as close as possible to the IGBTs to minimise commutation loop inductance. Every nanohenry of stray inductance translates to voltage overshoot (V = L * di/dt) during switching.
- Use wide, low-inductance bus bars or thick copper pours for the DC+, DC-, and phase output connections. At 50A RMS (70A peak), the copper cross-section must be adequate for both current carrying capacity and thermal management.
- The gate drive traces should be kept short and routed as differential pairs (gate and emitter return) to minimise common-mode noise coupling.
- Each IGBT requires a thermal interface (pad or compound) to the heatsink. The TO-247 collector tab is typically at collector potential, so electrical isolation (insulating washer or pad) is required between devices sharing a heatsink.
- Place the NTC thermistors in thermal contact with the heatsink, positioned between IGBT mounting locations for representative temperature measurement.

---

## Further Work and Known Issues

1. **Snubber / clamp circuits**: RC snubbers or TVS diodes across each IGBT to clamp collector-emitter overshoot during turn-off. Size depends on parasitic inductance of the final PCB layout.
2. **Gate driver schematic**: Isolated gate drivers (e.g. Infineon 2ED020I12 or similar) with dead-time generation, DESAT protection, and isolated power supplies. This is a separate schematic sheet.
3. **DC link pre-charge**: An inrush current limiter (resistor + bypass contactor) is needed to safely charge the DC link from the supply without damaging the capacitors or upstream rectifier.
4. **Split gate resistors**: Separate turn-on and turn-off gate resistance using diode steering for independent dv/dt and di/dt control.
5. **High-frequency decoupling**: Additional small film or ceramic capacitors (1-4.7uF, C0G/X7R, 630V+) placed close to each half-bridge leg for commutation loop decoupling.
6. **Current sensing**: Phase current measurement (shunt resistors or Hall-effect sensors) is required for closed-loop control but not part of this power stage design.
7. **EMI filtering**: Common-mode and differential-mode output filters may be required depending on cable length and motor type.
