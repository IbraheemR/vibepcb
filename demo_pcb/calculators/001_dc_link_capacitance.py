"""
DC link capacitor sizing for three-phase IGBT inverter.

Calculates minimum capacitance based on:
  - Ripple voltage requirement
  - RMS ripple current through the DC link

References:
  - Mohan, "Power Electronics", Ch. 8
  - Infineon AN2012-05: DC link capacitor design guide
"""

import math

# --- Input parameters ---
V_dc = 600          # DC bus voltage [V]
I_phase_rms = 50    # Phase current RMS [A]
f_sw = 10e3         # Switching frequency [Hz]
m = 0.9             # Modulation index (0..1)
cos_phi = 0.85      # Power factor (motor load)
dV_ripple_pct = 2   # Allowed peak-to-peak ripple as % of V_dc

# --- Calculations ---

# Allowed ripple voltage
dV_ripple = V_dc * (dV_ripple_pct / 100)
print(f"Allowed ripple voltage: {dV_ripple:.1f} V ({dV_ripple_pct}% of {V_dc} V)")

# DC link RMS ripple current for 3-phase PWM inverter
# Formula from Infineon app note:
#   I_cap_rms = I_phase_rms * sqrt(2*m*(sqrt(3)/(4*pi) + cos_phi^2*(sqrt(3)/(4*pi) - 9*m/(16*pi^2))))
# Simplified conservative estimate:
#   I_cap_rms ≈ I_phase_rms * sqrt(2*m/pi) for typical loads
I_cap_rms_approx = I_phase_rms * math.sqrt(2 * m / math.pi)

# More precise formula
term1 = math.sqrt(3) / (4 * math.pi)
term2 = cos_phi**2 * (math.sqrt(3) / (4 * math.pi) - 9 * m / (16 * math.pi**2))
I_cap_rms = I_phase_rms * math.sqrt(2 * m * (term1 + term2))

print(f"\nRMS ripple current (precise): {I_cap_rms:.1f} A")
print(f"RMS ripple current (approx):  {I_cap_rms_approx:.1f} A")

# Minimum capacitance from ripple voltage requirement
# For a 3-phase inverter, worst-case charge variation per switching cycle:
#   dQ = I_phase_peak / (2 * f_sw)
#   C_min = dQ / dV_ripple
I_phase_peak = I_phase_rms * math.sqrt(2)
dQ = I_phase_peak / (2 * f_sw)
C_min_ripple = dQ / dV_ripple

print(f"\n--- Minimum capacitance (ripple voltage) ---")
print(f"I_phase_peak: {I_phase_peak:.1f} A")
print(f"C_min (ripple): {C_min_ripple*1e6:.0f} uF")

# --- Capacitor selection ---
# B32778 series: 100uF, 900V, 30A ripple current each, 3 mOhm ESR
cap_value_uF = 100
cap_ripple_A = 30
cap_ESR_mOhm = 3

# How many caps needed for ripple current?
n_caps_ripple = math.ceil(I_cap_rms / cap_ripple_A)

# How many caps needed for capacitance?
n_caps_capacitance = math.ceil(C_min_ripple * 1e6 / cap_value_uF)

n_caps = max(n_caps_ripple, n_caps_capacitance)

print(f"\n--- B32778 100uF/900V cap selection ---")
print(f"Caps needed for ripple current ({I_cap_rms:.1f}A / {cap_ripple_A}A per cap): {n_caps_ripple}")
print(f"Caps needed for capacitance ({C_min_ripple*1e6:.0f}uF / {cap_value_uF}uF per cap): {n_caps_capacitance}")
print(f"Minimum caps required: {n_caps}")

total_C = n_caps * cap_value_uF
total_ripple = n_caps * cap_ripple_A
total_ESR = cap_ESR_mOhm / n_caps
ESR_heating = I_cap_rms**2 * total_ESR / 1000

print(f"\nWith {n_caps} caps:")
print(f"  Total capacitance: {total_C} uF")
print(f"  Total ripple rating: {total_ripple} A (margin: {total_ripple/I_cap_rms:.1f}x)")
print(f"  Combined ESR: {total_ESR:.1f} mOhm")
print(f"  ESR heating: {ESR_heating:.1f} W")
print(f"  Ripple voltage (ESR-dominated): {I_cap_rms * total_ESR / 1000 * 1000:.1f} mV")
