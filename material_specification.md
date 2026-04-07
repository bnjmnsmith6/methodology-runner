# Material Specification: Universal Reusable Coffee Cup Handle

**Document version:** 1.0
**Date:** 2026-04-07
**Status:** Proposed — pending physical test validation (see `testing_protocol.md`)
**Scope:** Handle component only; attachment mechanism and cup body are out of scope

---

## Executive Summary

Two materials are specified for the handle assembly in a composite configuration:

| Role | Primary Material | Backup Material |
|---|---|---|
| Grip / insulation layer | Platinum-cured food-grade silicone (21 CFR §177.2600) | PEI Ultem 1010 with silicone overmold |
| Structural frame | PEEK (21 CFR §177.2415) | Stainless Steel 316 (NSF/ANSI 51) |

Both primary materials hold confirmed FDA food contact approval, withstand 180°F continuous exposure with significant safety margin, and are projected to exceed 100 thermal use cycles. Physical validation testing per `testing_protocol.md` is required before production release.

---

## 1. Primary Material Specification

### 1.1 Grip / Insulation: Platinum-Cured Food-Grade Silicone

| Attribute | Specification |
|---|---|
| **Name** | Platinum-cured silicone rubber, food grade |
| **Chemical composition** | Polydimethylsiloxane (PDMS), platinum-catalyzed cross-link, no fillers except those listed in 21 CFR §177.2600(c) |
| **FDA status** | APPROVED — 21 CFR §177.2600 (Rubber articles intended for repeated use) |
| **Hardness (Shore A)** | 40–60 Shore A (firm enough for grip, compliant enough for comfort) |
| **Continuous service temperature** | -65°F to 450°F (-54°C to 232°C) |
| **Heat resistance at 180°F** | PASS — 270°F safety margin above service temperature |
| **Cycle rating** | 500+ thermal cycles |
| **Dishwasher safe** | Yes — tolerates 140–160°F wash with alkaline detergent |
| **Leach risk** | Very low — no residual catalyst by-products from platinum cure |
| **Safety notes** | Supplier must provide Certificate of Compliance (CoC) citing 21 CFR §177.2600; specify platinum-cure explicitly in purchase order; reject peroxide-cured substitutions |
| **Testing required** | T1 (thermal resistance), T2 (thermal cycling), T3 (leaching — all 3 simulants), T4 (dishwasher), T5 (load at temperature) |

**Rationale for selection:** Platinum-cured silicone is the industry standard for food-contact grips, baby products, and kitchen tools. It is chemically inert at all coffee service temperatures, provides thermal insulation to prevent user burns, has regulatory history under §177.2600, and widely available in commercial food-grade supply chains. No other polymer offers comparable thermal tolerance, compliance certainty, and grip ergonomics at this use temperature.

---

### 1.2 Structural Frame: PEEK (Polyether Ether Ketone)

| Attribute | Specification |
|---|---|
| **Name** | PEEK — Polyarylether ketone resin, food-contact grade |
| **Chemical composition** | Semi-crystalline poly(oxy-1,4-phenyleneoxy-1,4-phenylenecarbonyl-1,4-phenylene); repeating aryl ether ketone units |
| **FDA status** | APPROVED — 21 CFR §177.2415 (Polyarylether ketone resins) |
| **Acceptable commercial grades** | Victrex PEEK 450G; Solvay KetaSpire KT-820 NL; Evonik VESTAKEEP 4000G (verify current grade CoC before procurement) |
| **Tensile strength (room temp)** | ~100 MPa (14,500 psi) |
| **Continuous service temperature** | Up to 480°F (250°C) |
| **Glass transition temperature** | 289°F (143°C) — far above 180°F service |
| **Heat resistance at 180°F** | PASS — 109°F margin to Tg; 300°F margin to continuous service limit |
| **Cycle rating** | 1,000+ thermal cycles |
| **Dishwasher safe** | Yes |
| **Leach risk** | Very low — chemically inert at service temperature |
| **Safety notes** | Confirm specific commercial grade compliance with 21 CFR §177.2415 via grade-specific CoC; standard industrial PEEK grades may not carry food contact certification |
| **Testing required** | T1, T2, T3 (Simulants A and B), T4, T5 |

**Rationale for selection:** PEEK provides exceptional mechanical properties and thermal stability far exceeding the application requirements. Its FDA clearance under §177.2415 is well-established for food processing equipment. The material is rigid, fatigue-resistant, and maintains mechanical properties at 180°F without measurable creep. This makes it ideal as the load-bearing structural element of the handle frame.

---

## 2. Backup Material Specification

### 2.1 Backup Grip / Insulation: PEI (Ultem 1010) with Silicone Overmold

If platinum-cured silicone fails supply chain verification or test validation:
- Use **PEI Ultem 1010** (21 CFR §177.1630) as the structural/grip substrate
- Overmold or sleeve with thin platinum-cured silicone layer for grip comfort
- Ultem 1010 specifically is the food-contact grade; Ultem 1000 is NOT food-contact approved
- Document Ultem 1010 grade in CoC and purchase specs

### 2.2 Backup Structural Frame: Stainless Steel 316

If PEEK fails supply verification or test validation:
- Use **Stainless Steel 316** (UNS S31600; ASTM A276/A240; NSF/ANSI 51)
- Require passivation certification per ASTM A967 or ASTM A380
- Silicone overmold is mandatory — bare metal at 180°F will cause burns
- 316 preferred over 304 for chloride resistance in dishwasher environments

---

## 3. Compliance Summary

| Material | Regulatory Reference | Status | Citation |
|---|---|---|---|
| Platinum-cured silicone | 21 CFR §177.2600 | APPROVED | Rubber articles intended for repeated use |
| PEEK (food-grade grade) | 21 CFR §177.2415 | APPROVED | Polyarylether ketone resins |
| PEI Ultem 1010 (backup) | 21 CFR §177.1630 | CONDITIONALLY APPROVED | Polyimide resins — grade-specific |
| Stainless Steel 316 (backup) | NSF/ANSI 51; GRAS principles per 21 CFR §170.3 | APPROVED | Food equipment materials standard |

**Invariant:** No material enters production without current supplier CoC and passing test results from all applicable tests in `testing_protocol.md`.

---

## 4. Testing Requirements Before Production Release

The following tests from `testing_protocol.md` must be completed and documented:

| Test | Primary Silicone | Primary PEEK | Backup SS316 |
|---|---|---|---|
| T1: Thermal resistance (180°F continuous) | Required | Required | Required |
| T2: Thermal cycling (110 cycles) | Required | Required | Required |
| T3: Leaching (3 simulants) | Required | Required | Required |
| T4: Dishwasher (200 cycles) | Required | Required | Required |
| T5: Load at temperature | Required | Required | Required |

All test reports must be retained in the project quality file and available for regulatory review.

---

## 5. Procurement Documentation Requirements

For each material procured, the following documents must be on file before use:

1. **Certificate of Compliance (CoC)** — citing specific FDA CFR section
2. **Safety Data Sheet (SDS)** — current version
3. **Material test report** — confirming composition and key properties
4. **Extractables/leachables data** — from supplier or independent laboratory
5. **For metals:** Mill certification to ASTM standard; passivation certificate if applicable
6. **Grade identification** — exact commercial grade name and lot number

---

## 6. Disqualified Materials

The following materials were evaluated and excluded. They must not be substituted without re-evaluation:

| Material | Reason for Exclusion |
|---|---|
| Peroxide-cured silicone | Residual peroxide by-products; non-preferred under §177.2600 when platinum alternative available |
| Polypropylene (PP) | Marginal thermal performance at 180°F continuous; creep risk under load |
| HDPE | Potential softening/warping at 180°F; not suitable for structural use |
| Aluminum (anodized) | Uncertain FDA food contact status; reacts with acidic beverages if anodize layer is damaged |

---

## 7. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Supplier discontinues food-grade PEEK grade | Low | High | Maintain approved alternate grade list; requalify new grades per this specification |
| FDA updates 21 CFR §177.2600 or §177.2415 | Very Low | High | Annual regulatory review; subscribe to FDA Federal Register notifications |
| Silicone CoC does not specify platinum cure | Medium | High | Add explicit platinum-cure requirement to purchase order spec; reject peroxide-cured substitutions |
| Physical testing reveals migration above limits | Low | High | Backup materials (SS316, PEI) are pre-qualified to proceed to testing |
| Dishwasher detergent degrades silicone surface | Low | Medium | T4 test protocol uses standard alkaline detergent; inspect surface monthly during life testing |

---

## 8. Assumptions

| # | Assumption | Impact if Wrong |
|---|---|---|
| 1 | Standard residential dishwasher temperatures are 140–160°F | If higher, re-run T4 at actual temperature; all candidate materials still likely pass given thermal margins |
| 2 | Handle attachment mechanism does not introduce non-compliant materials at food contact zones | Attachment mechanism design must be reviewed separately when defined |
| 3 | 100+ cycles = daily use for 3+ months (~100 days) | If lifecycle definition changes, update T2 cycle count proportionally |

---

## 9. Revision and Review

This specification must be reviewed and updated if:
- A new material candidate is proposed
- FDA regulations covering listed materials are amended
- Physical test results cause a material to fail
- Handle geometry changes affect load distribution assumptions
- Supplier changes grade formulation or discontinues food-contact certification
