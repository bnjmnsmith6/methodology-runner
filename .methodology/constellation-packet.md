@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: READY
@@CONFIDENCE: MEDIUM
@@OPEN_DECISIONS: 0
@@OPEN_ASSUMPTIONS: 2
@@END_HEADER

# Constellation Packet

## 1. Objective
- **Problem**: Need comprehensive analysis of mechanical trick locks using 2-piece tactile alignment mechanisms for puzzle applications
- **Desired outcome**: Categorized database of available tactile alignment locks with vendor information, difficulty ratings, and puzzle vs security classification
- **Success checks**: 15+ verified products with complete vendor data, tactile mechanism descriptions, and availability status

## 2. In scope / Out of scope

**In scope:**
- 2-piece tactile alignment mechanisms (physical components that must align through feel)
- Puzzle-oriented locks and mechanical challenges
- Hand angle precision requirements analysis
- Current vendor availability verification
- Puzzle vs security device classification

**Out of scope:**
- Key-based locks
- Digital/electronic combination locks
- Sequence-based mechanical puzzles (dials, sliders)
- Historical or discontinued products without current availability
- Security effectiveness analysis
- Pricing research beyond basic availability

## 3. Source-of-truth constraints
- Focus exclusively on tactile alignment mechanisms (not visual or auditory)
- Must be currently purchasable from verified vendors
- Puzzle classification takes precedence over security function
- Hand positioning/angle precision must be documentable requirement
- 2-piece minimum component requirement for alignment mechanism

## 4. Architecture and flow
**Components:**
- Product research module (web scraping + manual verification)
- Vendor verification system
- Tactile mechanism classification engine
- Data validation and storage

**Data flow:**
1. Source identification → Product discovery → Mechanism analysis → Vendor verification → Classification → Database storage

**External dependencies:**
- Vendor websites and catalogs
- Puzzle/escape room supplier networks
- Product specification sheets

## 5. Contracts and invariants

**Product record schema:**
```
{
  product_name: string,
  vendor: {name, url, contact, verified_date},
  mechanism_type: "tactile_alignment",
  piece_count: integer ≥ 2,
  difficulty_rating: 1-10 scale,
  hand_precision_required: boolean,
  puzzle_classification: "puzzle" | "security" | "hybrid",
  availability_status: "in_stock" | "backorder" | "discontinued",
  tactile_description: string,
  verification_date: date
}
```

**Invariants:**
- All products must have verified vendor contact within last 30 days
- Tactile mechanism must be primary solving method
- Classification must be documented with reasoning

## 6. File-by-file implementation plan

**research_sources.py**
- Purpose: Source identification and initial discovery
- Change required: Create new file
- Key functions: `discover_vendors()`, `scrape_product_catalogs()`, `validate_source_quality()`

**mechanism_analyzer.py**
- Purpose: Classify and analyze tactile mechanisms
- Change required: Create new file
- Key functions: `classify_mechanism()`, `assess_tactile_requirements()`, `rate_difficulty()`

**vendor_verifier.py**
- Purpose: Verify current availability and contact vendors
- Change required: Create new file
- Key functions: `verify_availability()`, `contact_vendor()`, `update_status()`

**data_models.py**
- Purpose: Database schema and validation
- Change required: Create new file
- Key classes: `TactileLock`, `Vendor`, `MechanismType`

**main_research.py**
- Purpose: Orchestrate research workflow
- Change required: Create new file
- Key functions: `run_research_pipeline()`, `generate_report()`

**output/tactile_locks_database.json**
- Purpose: Final structured dataset
- Change required: Create new file
- Content: Validated product records array

## 7. Build order

1. **Setup data models** - Define schemas and validation rules
2. **Build source discovery** - Implement vendor/catalog identification
3. **Create mechanism analyzer** - Tactile classification logic
4. **Implement vendor verification** - Availability checking system
5. **Build main pipeline** - Integrate all components
6. **Execute research** - Run discovery and analysis
7. **Generate final database** - Export validated results

## 8. Acceptance tests

**Completeness tests:**
- ≥15 verified tactile alignment lock products
- 100% of products have verified vendor contact
- All products classified as puzzle/security/hybrid with reasoning

**Quality tests:**
- All tactile mechanisms described in detail
- Hand precision requirements documented for each
- Availability status verified within 30 days
- No key-based or sequence-based locks included

**Data integrity tests:**
- All required schema fields populated
- Vendor URLs return 200 status
- Product names unique within dataset
- Difficulty ratings justified

## 9. Risks, assumptions, and rollback

**Assumptions:**
1. Vendors will respond to availability inquiries within reasonable timeframe
2. Sufficient products exist in this specific category (tactile alignment)

**Risk hotspots:**
- Limited availability in niche category may yield <15 products
- Vendor responsiveness may be poor for specialty items
- Classification between puzzle/security may be subjective

**Rollback plan:**
- If <10 products found, expand to include 1-piece tactile mechanisms
- If vendors unresponsive, rely on website inventory status only

## 10. Escalate instead of guessing

**STOP_AND_ASK conditions:**
- Unclear mechanism classification (not obviously tactile alignment)
- Vendor claims security-only use but mechanism appears puzzle-suitable
- Product availability ambiguous after vendor contact
- Difficulty rating unclear without hands-on testing
- Pricing research requests (out of scope per constraints)

**Automatic escalation triggers:**
- <5 products found after initial research phase
- >50% of discovered products lack current vendor availability
- Major vendor claims products are restricted/regulated items