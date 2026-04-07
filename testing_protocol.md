# Testing Protocol: Coffee Cup Handle Materials Validation

## Purpose
Define the validation test procedures that confirm shortlisted handle materials meet the acceptance criteria:
- Heat resistance at 160–180°F continuous exposure
- Structural integrity after 100+ thermal use cycles
- No harmful leaching into beverages
- Dishwasher safety at standard residential settings

**Applies to:** Platinum-cured silicone, PEEK, Stainless Steel 316, PEI (Ultem 1010)

**Reference standards:** ASTM, ISO, FDA guidance documents

---

## Test 1: Thermal Resistance — Continuous Exposure

**Objective:** Verify materials do not degrade, deform, or lose structural properties under sustained exposure to maximum coffee service temperature.

**Standard reference:** ASTM D648 (deflection temperature under load); ISO 75 (heat distortion temperature)

**Procedure:**
1. Condition test specimens (per ASTM D618: 23°C, 50% RH, 40 hours) prior to testing.
2. Submerge or expose specimens to water bath at 180°F (82°C) ± 2°F for 4 hours continuous.
3. Measure dimensional changes (length, width, thickness) before and after to ±0.01 mm.
4. Perform Shore A/D hardness measurement (ASTM D2240) before and after for polymers.
5. Visually inspect for discoloration, cracking, delamination, or surface changes.
6. For stainless steel: inspect weld zones and surface finish.

**Pass criteria:**
- Dimensional change ≤ 0.5% in any axis
- Hardness change ≤ 5 Shore units
- No visible cracking, delamination, or surface degradation
- No color change indicating chemical breakdown

**Specimen count:** Minimum 5 specimens per material per test.

---

## Test 2: Thermal Cycling Durability — 100+ Cycle Simulation

**Objective:** Simulate repeated hot-beverage use and cooling to verify materials maintain structural integrity over the expected product lifetime (100 cycles minimum, representing ~3 months daily use).

**Standard reference:** IEC 60068-2-14 (thermal shock and cycling); ASTM F1980 (accelerated aging)

**Cycle definition (1 cycle = 1 simulated use):**
- Hot phase: 30 minutes at 180°F (82°C) in water bath
- Transition: 2 minutes ambient air (simulates cup removal and cooling)
- Cold phase: 10 minutes at 70°F (21°C) ambient or room-temperature water rinse
- Total cycle time: ~45 minutes

**Procedure:**
1. Measure baseline dimensions, hardness, and tensile properties (ASTM D638 for polymers; ASTM E8 for metals).
2. Run 110 cycles (10% margin above 100-cycle requirement).
3. Inspect visually every 25 cycles for surface changes, cracking, or deformation.
4. At cycle 50 and cycle 110: measure dimensions, hardness, and tensile properties.
5. Perform pull-force test simulating handle grip load: apply 25 lbf lateral load for 30 seconds at 180°F after final cycle.
6. Inspect attachment interface zones for fatigue cracking.

**Pass criteria:**
- No failure or cracking at any cycle checkpoint
- Tensile strength retention ≥ 90% of baseline at cycle 110
- Dimensional change ≤ 1.0% after 110 cycles
- Pull-force test: no structural failure at 25 lbf at 180°F
- Visual: no crazing, cracking, or surface pitting

**Specimen count:** Minimum 5 specimens per material.

---

## Test 3: Chemical Leaching / Migration Testing

**Objective:** Confirm materials do not leach harmful substances into simulated coffee beverage at service temperatures.

**Standard reference:** FDA guidance "Preparation of Premarket Notifications for Food Contact Substances" (2002); EU 10/2011 (reference for migration limits); ASTM F34 committee protocols

**Simulants used:**
- Simulant A: Distilled water at 180°F (for aqueous/neutral beverages)
- Simulant B: 3% acetic acid solution at 180°F (for acidic coffee pH simulation, pH ~4.5–5)
- Simulant C: 50% ethanol at 70°F (for lipophilic extraction — simulates flavored/creamy beverages)

**Procedure:**
1. Prepare specimens: surface area 6 dm² per 1 L simulant (FDA standard ratio).
2. Expose specimens to each simulant under conditions:
   - Simulant A and B: 180°F, 2 hours contact time
   - Simulant C: 70°F, 24 hours contact time
3. Collect simulant samples post-exposure.
4. Analyze via:
   - Total organic carbon (TOC) — global migration indicator
   - ICP-MS for metals (chromium, nickel, iron, aluminum) — relevant for SS316 and any metal component
   - GC-MS for volatile organics — relevant for silicone and engineering polymers
   - HPLC for specific monomers (PEEK ketone/ether units; PEI imide/ether units)
5. Compare results to FDA threshold of regulation (0.5 ppb dietary concentration) and EU specific migration limits where applicable.

**Pass criteria:**
- Total migration: ≤ 10 mg/dm² (EU 10/2011 benchmark; conservative for FDA applications)
- Chromium (total): ≤ 0.05 mg/kg simulant (WHO drinking water guideline)
- Nickel: ≤ 0.02 mg/kg simulant
- No detectable specific monomers above 0.01 mg/kg
- TOC contribution from specimen: ≤ 5 mg/L above blank

**Specimen count:** 3 replicates per simulant per material; run blanks with each batch.

---

## Test 4: Dishwasher Durability

**Objective:** Confirm materials withstand repeated residential dishwasher cycles without degradation, deformation, or release of harmful substances.

**Standard reference:** ASTM D2444 (impact after environmental exposure); NSF/ANSI 184 (residential dishwashers — temperature profile reference)

**Dishwasher cycle simulation:**
- Wash temperature: 140–160°F (60–71°C)
- Detergent: Standard residential automatic dishwasher detergent (alkaline, pH 9–11)
- Rinse aid: Standard commercial rinse aid
- Cycle type: Normal/heavy wash cycle
- Total cycles: 200 cycles (2× the 100-cycle durability requirement)

**Procedure:**
1. Mount specimens in dishwasher rack in consistent orientation.
2. Run 200 consecutive dishwasher cycles using residential dishwasher.
3. Inspect every 50 cycles: dimensional measurement, visual inspection, hardness.
4. After 200 cycles: full property measurement (dimensions, hardness, tensile).
5. Perform leaching test (Test 3, Simulant A only) after 200 dishwasher cycles to detect any surface degradation-induced migration increase.

**Pass criteria:**
- No warping, cracking, or surface delamination
- Dimensional change ≤ 1.5% after 200 cycles
- Hardness retention ≥ 85% of baseline
- Color: no significant yellowing or discoloration (Delta E ≤ 5 per ASTM D2244)
- Post-dishwasher leaching: still within Test 3 pass criteria

**Specimen count:** 5 specimens per material.

---

## Test 5: Structural Integrity Under Load at Temperature

**Objective:** Verify handle does not fail under realistic grip forces when hot.

**Standard reference:** ASTM D638 (tensile); ASTM D790 (flexural); ASTM D256 (Izod impact)

**Procedure:**
1. Pre-condition specimens at 180°F for 30 minutes in water bath.
2. Immediately perform:
   a. Tensile test (ASTM D638): 5 specimens at 1 in/min crosshead speed
   b. Flexural test (ASTM D790): 5 specimens, 3-point bend, span per standard
   c. Repeat at room temperature for baseline comparison
3. Calculate retention ratios (hot/cold) for tensile strength, tensile modulus, flexural strength.

**Pass criteria:**
- Tensile strength at 180°F ≥ 70% of room-temperature baseline
- Flexural strength at 180°F ≥ 70% of room-temperature baseline
- No brittle failure mode (elongation-to-break for polymers ≥ 5% at temperature)

---

## Test Execution Summary

| Test | Cycles/Duration | Standard | Key Pass Criterion |
|---|---|---|---|
| T1: Thermal resistance | 4 hr continuous at 180°F | ASTM D648 / ISO 75 | ≤0.5% dimensional change; no degradation |
| T2: Thermal cycling durability | 110 cycles (hot/cool) | IEC 60068-2-14 | No failure; ≥90% tensile retention |
| T3: Chemical leaching | 2–24 hr per simulant | FDA guidance / EU 10/2011 | ≤10 mg/dm² total migration |
| T4: Dishwasher durability | 200 dishwasher cycles | NSF/ANSI 184 / ASTM D2444 | No cracking; ≤1.5% dimensional change |
| T5: Load at temperature | Per ASTM D638/D790 | ASTM D638, D790 | ≥70% hot strength retention |

---

## Test Sequence and Gate Logic

```
Material candidates (from fda_compliance_matrix.md)
        |
        v
[T3: Leaching] ──FAIL──> Disqualify material
        |
       PASS
        |
        v
[T1: Thermal Resistance] ──FAIL──> Disqualify material
        |
       PASS
        |
        v
[T5: Structural Load at Temp] ──FAIL──> Disqualify / consult backup
        |
       PASS
        |
        v
[T2: Thermal Cycling 110 cycles] ──FAIL──> Disqualify / consult backup
        |
       PASS
        |
        v
[T4: Dishwasher 200 cycles] ──FAIL──> Disqualify / consult backup
        |
       PASS
        |
        v
[Material approved — advance to material_specification.md]
```

---

## Documentation Requirements Per Test

For each test, the test report must include:
- Material identification (grade, lot number, supplier)
- Test date and laboratory (accredited per ISO/IEC 17025 preferred)
- Raw data and statistical summary (mean ± standard deviation)
- Pass/fail determination against criteria above
- Deviation log (any non-conformances in test execution)
- Reviewer signature and date
