"""
003_schmitt_1hz.py
------------------
Schmitt-trigger RC oscillator — 1 Hz LED flasher using 74HC14.

Standard design procedure
--------------------------
A single 74HC14 inverter feeds its output back to its input through a
resistor R. A capacitor C sits between the input node and GND.

When the output is HIGH (Vcc):
  The capacitor charges toward Vcc through R.
  When Vc reaches VT+ the output switches LOW.

When the output is LOW (0 V):
  The capacitor discharges toward 0 V through R.
  When Vc falls to VT- the output switches HIGH.

Charging time (output HIGH -> cap goes from VT- to VT+):
  t1 = R·C · ln((Vcc - VT-) / (Vcc - VT+))

Discharging time (output LOW -> cap goes from VT+ to VT-):
  t2 = R·C · ln(VT+ / VT-)

Period:  T  = t1 + t2
Freq:    f  = 1 / T
Duty cycle of gate output HIGH: dc = t1 / T
"""

import math

# ── Supply & threshold parameters ──────────────────────────────────────────
Vcc   = 5.0   # V  (supply voltage)
VT_hi = 1.6   # V  (positive-going threshold, 74HC14 typ at 4.5 V)
VT_lo = 0.9   # V  (negative-going threshold, 74HC14 typ at 4.5 V)

# ── Target ──────────────────────────────────────────────────────────────────
f_target = 1.0  # Hz

# ── K coefficient (timing constant) ─────────────────────────────────────────
k = math.log((Vcc - VT_lo) / (Vcc - VT_hi)) + math.log(VT_hi / VT_lo)
# T = k * R * C  ->  R * C = 1 / (f * k)
RC_required = 1.0 / (f_target * k)

print(f"=== 74HC14 Schmitt RC oscillator — {f_target} Hz ===")
print(f"Vcc  = {Vcc} V")
print(f"VT+  = {VT_hi} V   (positive threshold, typ)")
print(f"VT-  = {VT_lo} V   (negative threshold, typ)")
print(f"k    = {k:.4f}  (timing coefficient, T = k·R·C)")
print(f"Required RC = {RC_required:.4f} s\n")

# ── Preferred E24 resistor values (kOhm) ──────────────────────────────────────
e24_k = [
    10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30,
    33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91,
    100, 110, 120, 130, 150, 160, 180, 200, 220, 240,
    270, 300, 330, 360, 390, 430, 470,
]

C = 10e-6  # 10 uF timing capacitor

print(f"Chosen capacitor: C = {C*1e6:.0f} uF")
print(f"Required R       = {RC_required / C / 1e3:.1f} kOhm\n")

# Find the E24 resistor that gives frequency closest to target
best_R = None
best_diff = float("inf")
for R_k in e24_k:
    R = R_k * 1e3
    f_actual = 1.0 / (k * R * C)
    err = abs(f_actual - f_target)
    if err < best_diff:
        best_diff = err
        best_R = R_k

R = best_R * 1e3
T  = k * R * C
f  = 1.0 / T
t1 = R * C * math.log((Vcc - VT_lo) / (Vcc - VT_hi))  # gate output HIGH
t2 = R * C * math.log(VT_hi / VT_lo)                   # gate output LOW
dc_gate = t1 / T  # gate 1 output high fraction

print(f"=== Best standard resistor ===")
print(f"R    = {best_R} kOhm  (E24 value)")
print(f"C    = {C*1e6:.0f} uF")
print(f"T    = {T:.4f} s  ->  f = {f:.3f} Hz  (error {(f-f_target)/f_target*100:+.1f}%)")
print(f"t_charge    = {t1*1000:.1f} ms  (gate 1 OUT=HIGH, cap charges VT-->VT+)")
print(f"t_discharge = {t2*1000:.1f} ms  (gate 1 OUT=LOW,  cap discharges VT+->VT-)")
print(f"Gate 1 output duty cycle (HIGH) = {dc_gate*100:.1f}%")
print(f"  -> LED (via inverting gate 2) ON for {(1-dc_gate)*100:.1f}% of each cycle\n")

# ── LED current ──────────────────────────────────────────────────────────────
Vf      = 2.0   # V  LED forward voltage (typical red LED)
R_LED   = 200   # Ohm  current-limiting resistor (standard value)
I_LED   = (Vcc - Vf) / R_LED
print(f"=== LED drive (gate 2, active-HIGH output) ===")
print(f"Supply = {Vcc} V,  Vf = {Vf} V,  R_LED = {R_LED} Ohm")
print(f"I_LED  = {I_LED*1000:.1f} mA  (well within 74HC14 25 mA max)")

# ── Summary ─────────────────────────────────────────────────────────────────
print(f"""
=== Bill of materials (passive values) ===
R1  {best_R} kOhm   0805  timing feedback resistor
C1  {C*1e6:.0f} uF    0805  timing capacitor
R2  {R_LED} Ohm    0805  LED series resistor
""")
