# -*- coding: utf-8 -*-
"""
004_lvc2g14_1hz.py
------------------
SN74LVC2G14 dual Schmitt-trigger inverter -- 1 Hz LED flasher.

The LVC2G14 has symmetric thresholds: VT+ + VT- = Vcc (typical).
This means t_charge == t_discharge and the oscillator produces a
50% duty cycle square wave -- an improvement over the 74HC14 design.

Standard design procedure (same RC oscillator topology):
  k = ln((Vcc - VT-) / (Vcc - VT+)) + ln(VT+ / VT-)
  T = k * R * C
  f = 1 / T

Because VT+ + VT- = Vcc:
  (Vcc - VT-) / (Vcc - VT+) = VT+ / VT-   (both equal)
  k = 2 * ln(VT+ / VT-)
  t_charge = t_discharge = T / 2  ->  50% duty cycle
"""

import math

# -- Supply and threshold parameters (SN74LVC2G14, Vcc = 5V, TI datasheet) --
Vcc   = 5.0   # V
VT_hi = 3.0   # V  positive-going threshold, typ at 5V
VT_lo = 2.0   # V  negative-going threshold, typ at 5V

# Confirm symmetry
print(f"Threshold symmetry check: VT+ + VT- = {VT_hi + VT_lo:.1f} V  (Vcc = {Vcc} V)")
print(f"  -> {'SYMMETRIC (50% duty cycle)' if abs(VT_hi + VT_lo - Vcc) < 0.01 else 'ASYMMETRIC'}\n")

f_target = 1.0  # Hz

k = math.log((Vcc - VT_lo) / (Vcc - VT_hi)) + math.log(VT_hi / VT_lo)
RC_required = 1.0 / (f_target * k)

print(f"=== SN74LVC2G14 RC oscillator -- {f_target} Hz ===")
print(f"Vcc  = {Vcc} V")
print(f"VT+  = {VT_hi} V  (positive threshold, typ at 5V)")
print(f"VT-  = {VT_lo} V  (negative threshold, typ at 5V)")
print(f"k    = {k:.4f}  (= 2 * ln(VT+/VT-) = {2*math.log(VT_hi/VT_lo):.4f})")
print(f"Required RC = {RC_required:.4f} s\n")

# -- E24 resistor search -------------------------------------------------
e24_k = [
    10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30,
    33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91,
    100, 110, 120, 130, 150, 160, 180, 200, 220, 240,
    270, 300, 330, 360, 390, 430, 470,
]

C = 10e-6  # 10 uF
print(f"Chosen capacitor: C = {C*1e6:.0f} uF")
print(f"Required R       = {RC_required / C / 1e3:.1f} kOhm\n")

best_R_k = min(e24_k, key=lambda r: abs(1.0 / (k * r * 1e3 * C) - f_target))

R = best_R_k * 1e3
T  = k * R * C
f  = 1.0 / T
t1 = R * C * math.log((Vcc - VT_lo) / (Vcc - VT_hi))
t2 = R * C * math.log(VT_hi / VT_lo)
dc_gate = t1 / T

print(f"=== Best standard resistor ===")
print(f"R    = {best_R_k} kOhm  (E24)")
print(f"C    = {C*1e6:.0f} uF")
print(f"T    = {T:.4f} s  ->  f = {f:.3f} Hz  (error {(f-f_target)/f_target*100:+.2f}%)")
print(f"t_charge    = {t1*1000:.1f} ms  (gate 1 OUT=HIGH)")
print(f"t_discharge = {t2*1000:.1f} ms  (gate 1 OUT=LOW)")
print(f"Gate 1 duty cycle (HIGH) = {dc_gate*100:.1f}%")
print(f"  -> LED (via inverting gate 2) ON for {(1-dc_gate)*100:.1f}% of each cycle\n")

# -- LED current ---------------------------------------------------------
Vf    = 2.0   # V  red LED forward voltage
R_LED = 200   # Ohm
I_LED = (Vcc - Vf) / R_LED
print(f"=== LED drive (gate 2 output) ===")
print(f"Supply = {Vcc} V,  Vf = {Vf} V,  R_LED = {R_LED} Ohm")
print(f"I_LED  = {I_LED*1000:.1f} mA  (within SN74LVC2G14 32 mA max)\n")

# -- Comparison table ----------------------------------------------------
print("=== Comparison: 74HC14 vs SN74LVC2G14 ===")
VT_hi_hc = 1.6; VT_lo_hc = 0.9; R_hc = 130e3; C_hc = 10e-6
k_hc = math.log((Vcc-VT_lo_hc)/(Vcc-VT_hi_hc)) + math.log(VT_hi_hc/VT_lo_hc)
T_hc = k_hc * R_hc * C_hc
t1_hc = R_hc * C_hc * math.log((Vcc-VT_lo_hc)/(Vcc-VT_hi_hc))
dc_hc = t1_hc / T_hc
print(f"  74HC14   (SOIC-14, 6 gates, 4 unused): f={1/T_hc:.3f} Hz, LED on {(1-dc_hc)*100:.0f}% of cycle")
print(f"  LVC2G14  (SOT-23-6, 2 gates, 0 unused): f={f:.3f} Hz, LED on {(1-dc_gate)*100:.0f}% of cycle")

print(f"""
=== Bill of materials (passive values) ===
R1  {best_R_k} kOhm  0805  timing feedback resistor
C1  {C*1e6:.0f} uF     0805  timing capacitor
R2  {R_LED} Ohm   0805  LED series resistor
C2  100 nF    0805  VCC bypass
""")
