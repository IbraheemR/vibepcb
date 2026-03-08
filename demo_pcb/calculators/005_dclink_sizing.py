"""
DC Link Capacitor Sizing for Three-Phase Inverter Power Stage

Sizes DC link capacitance based on:
- RMS ripple current (primary sizing criterion)
- Voltage ripple specification

Holdup / bulk energy storage is a system-level concern handled by the
upstream rectifier or PFC stage, not the inverter DC link itself.

References:
- Kolar et al., "Analytical calculation of DC-link capacitor RMS current"
- Infineon AN2012-09: "DC-Link Capacitor Design for Inverters"
"""

import math

# ─── Input Parameters ───────────────────────────────────────────────
V_bus       = 600       # DC bus voltage [V]
I_out_rms   = 50        # Output phase current, RMS [A]
f_sw        = 10e3      # Switching frequency [Hz]
f_out       = 50        # Output fundamental frequency [Hz]
m           = 0.9       # Modulation index (0 to 1)
cos_phi     = 0.85      # Power factor (displacement)
V_ripple_pp = 12        # Allowed peak-to-peak voltage ripple [V] (2% of Vbus)

# ─── Calculations ───────────────────────────────────────────────────

# 1) Output power estimate (three-phase)
#    P = (3/2) * V_bus * m * I_out_rms * cos_phi  (for SPWM, line-neutral)
#    Simpler: P = sqrt(3) * V_LL_rms * I_out_rms * cos_phi
#    where V_LL_rms = m * V_bus / sqrt(2) * sqrt(3)/sqrt(2)...
#    Just use P = 3 * (m*V_bus/2/sqrt(2)) * I_out_rms * cos_phi
V_phase_rms = m * V_bus / (2 * math.sqrt(2))
P_out = 3 * V_phase_rms * I_out_rms * cos_phi

# 2) RMS ripple current in DC link capacitor
#    For three-phase two-level inverter with SPWM (Kolar et al.):
#    I_cap_rms = I_out_rms * sqrt(2*m * (sqrt(3)/pi - 9*m/16 * cos_phi^2))
I_cap_rms = I_out_rms * math.sqrt(
    2 * m * (math.sqrt(3) / math.pi - 9 * m / 16 * cos_phi**2)
)

# 3) Minimum capacitance for voltage ripple at switching frequency
#    Charge delivered per switching cycle: Q = I_cap_peak / f_sw
#    dV = Q / C  =>  C = I_cap_peak / (f_sw * dV)
I_cap_peak = math.sqrt(2) * I_cap_rms
C_min_ripple = I_cap_peak / (2 * math.pi * f_sw * (V_ripple_pp / 2))

# 4) Apply 1.5x margin
C_design = C_min_ripple * 1.5

# ─── Capacitor Selection ────────────────────────────────────────────
# Using film capacitors (polypropylene) for low ESR/ESL at switching freq.
# EPCOS/TDK B32778 series — 900VDC rated (1.5x derating on 600V bus)
# Available: 10uF, 20uF, 30uF, 40uF
# Ripple current: ~25A RMS per cap at 10kHz

cap_value_each  = 40e-6   # Individual cap value [F]
cap_ripple_each = 25       # Ripple current rating per cap [A_rms]

n_caps_capacitance = math.ceil(C_design / cap_value_each)
n_caps_ripple      = math.ceil(I_cap_rms / cap_ripple_each)
n_caps = max(n_caps_capacitance, n_caps_ripple)

C_total = n_caps * cap_value_each

# ─── Output ─────────────────────────────────────────────────────────
print("=" * 60)
print("THREE-PHASE INVERTER DC LINK SIZING")
print("=" * 60)
print()
print(f"  DC bus voltage:         {V_bus} V")
print(f"  Output current (RMS):   {I_out_rms} A")
print(f"  Switching frequency:    {f_sw/1e3:.1f} kHz")
print(f"  Modulation index:       {m}")
print(f"  Power factor:           {cos_phi}")
print(f"  Approx output power:    {P_out/1e3:.1f} kW")
print()
print("--- Ripple Current ---")
print(f"  DC link RMS ripple:     {I_cap_rms:.1f} A")
print(f"  DC link peak ripple:    {I_cap_peak:.1f} A")
print()
print("--- Capacitance Requirements ---")
print(f"  For voltage ripple:     {C_min_ripple*1e6:.1f} uF  (Vpp = {V_ripple_pp} V)")
print(f"  With 1.5x margin:      {C_design*1e6:.1f} uF")
print()
print("--- Capacitor Selection ---")
print(f"  Cap type:               Film (polypropylene), 900VDC rated")
print(f"  Individual value:       {cap_value_each*1e6:.0f} uF")
print(f"  Ripple rating each:     {cap_ripple_each} A_rms @ {f_sw/1e3:.0f}kHz")
print(f"  Qty for capacitance:    {n_caps_capacitance}")
print(f"  Qty for ripple:         {n_caps_ripple}")
print(f"  Selected quantity:      {n_caps}")
print(f"  Total capacitance:      {C_total*1e6:.0f} uF")
print(f"  Total ripple rating:    {n_caps * cap_ripple_each} A_rms (need {I_cap_rms:.1f} A)")
print()
print("=" * 60)
