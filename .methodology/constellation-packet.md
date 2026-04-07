@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: READY
@@CONFIDENCE: MEDIUM
@@OPEN_DECISIONS: 0
@@OPEN_ASSUMPTIONS: 3
@@END_HEADER

# Constellation Packet

## 1. Objective
- **Problem:** Identify and specify materials for a universal reusable coffee cup handle that meet safety regulations and performance requirements
- **Desired outcome:** Material specification document with regulatory compliance verification and performance testing protocol
- **Success checks:** FDA compliance confirmed, heat resistance validated at 160-180°F, durability proven for 100+ cycles

## 2. In scope / Out of scope

**In scope:**
- Material research for handle component only
- FDA food contact surface regulations compliance
- Heat resistance requirements (160-180°F)
- Durability testing protocols for 100+ use cycles
- Material safety data compilation
- Regulatory documentation requirements

**Out of scope:**
- Cup body materials
- Manufacturing process selection
- Cost optimization
- Supplier sourcing
- Attachment mechanism design
- Aesthetic considerations beyond safety markings

## 3. Source-of-truth constraints
- Must comply with FDA 21 CFR Part 177 (food contact substances)
- Must withstand continuous exposure to 180°F without degradation
- Must maintain structural integrity after 100 thermal cycles
- Must not leach harmful substances into beverages
- Must be dishwasher safe at standard residential settings

## 4. Architecture and flow
- **Components:** Material specification database, regulatory compliance matrix, testing protocol framework
- **Data flow:** Material properties → Regulatory check → Performance validation → Documentation output
- **Dependencies:** FDA databases, material supplier datasheets, testing standards (ASTM, ISO)

## 5. Contracts and invariants
- **Input:** Material candidates with basic properties (melting point, food contact rating)
- **Output:** Ranked material list with compliance status and test requirements
- **Schema:** Material record {name, chemical_composition, fda_status, heat_resistance, cycle_rating, safety_notes}
- **Invariant:** No material advances without FDA compliance confirmation

## 6. File-by-file implementation plan

**materials_research.md**
- Purpose: Catalog potential materials with properties
- Content: Silicone grades, thermoplastics, metal alloys with temp/safety ratings

**fda_compliance_matrix.xlsx**
- Purpose: Track regulatory status per material
- Columns: Material, CFR Section, Compliance Status, Restrictions, Documentation

**testing_protocol.md**
- Purpose: Define validation tests for heat resistance and durability
- Sections: Thermal cycling procedure, structural integrity tests, leaching tests

**material_specification.md**
- Purpose: Final recommendation with justification
- Content: Primary/backup materials, compliance summary, testing requirements

## 7. Build order
1. Research FDA 21 CFR Part 177 requirements and create compliance framework
2. Identify candidate materials (food-grade silicones, PEEK, PEI, stainless steel)
3. Map each candidate against FDA regulations
4. Define thermal cycling and durability test protocols
5. Cross-reference with dishwasher safety requirements
6. Generate final material specification with primary recommendation

## 8. Acceptance tests
- All recommended materials have confirmed FDA food contact approval
- Heat resistance validated through datasheet review for 180°F continuous exposure
- Testing protocol covers 100+ cycle durability verification
- Documentation includes regulatory citation numbers
- Backup material options identified in case primary fails testing

## 9. Risks, assumptions, and rollback

**Open assumptions:**
- Standard dishwasher temperatures (140-160°F) are within material tolerance
- "Universal" handle will use standard attachment mechanisms
- 100+ cycles means daily use for 3+ months

**Risk hotspots:**
- FDA regulations may have recent updates not reflected in accessible databases
- Material suppliers may discontinue food-grade certifications

**Rollback:** If primary material fails compliance, specification includes ranked alternatives

## 10. Escalate instead of guessing
- If FDA regulations are ambiguous or contradictory for any candidate material
- If no materials meet all requirements simultaneously (compliance + performance + durability)
- If testing protocols require specialized equipment beyond standard materials testing
- If cost implications of compliant materials appear prohibitive (though cost optimization is out of scope)