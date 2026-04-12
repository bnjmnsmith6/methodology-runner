@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: READY
@@CONFIDENCE: MEDIUM
@@OPEN_DECISIONS: 0
@@OPEN_ASSUMPTIONS: 2
@@END_HEADER

# Constellation Packet

## 1. Objective
- **Problem**: Need to identify traditional Japanese puzzle categories beyond modern Hanayama cast puzzles, specifically 2-piece variants using tactile alignment principles
- **Desired outcome**: Research report with categorized traditional puzzle types, identified 2-piece variants, and sourcing information for authentic pieces
- **Success checks**: Report contains at least 3 traditional puzzle categories, identifies 2+ 2-piece variants, includes contact info for 2+ current artisan makers/vendors

## 2. In scope / Out of scope

**In scope:**
- Historic Japanese puzzle categories (Karakuri boxes, traditional mechanical puzzles)
- 2-piece variants within these categories
- Tactile alignment mechanisms and principles
- Current artisan makers and authentic vendors
- Sourcing and availability information

**Out of scope:**
- Modern mass-produced puzzles (Hanayama cast line)
- Non-Japanese puzzle traditions
- Puzzles with >2 pieces unless they demonstrate relevant tactile principles
- Price comparison or purchasing recommendations
- DIY construction guides

## 3. Source-of-truth constraints
- Focus on traditional/historic categories, not modern interpretations
- Must identify actual 2-piece variants, not theoretical possibilities
- Vendor/artisan contacts must be currently active
- Tactile alignment must be the primary solving mechanism

## 4. Architecture and flow
- **Components**: Research database, categorization system, vendor contact list
- **Data flow**: Source identification → Category research → 2-piece variant filtering → Tactile mechanism analysis → Current maker identification
- **External dependencies**: Japanese craft databases, artisan websites, museum collections, academic sources

## 5. Contracts and invariants
- **Input**: Research query parameters (traditional, Japanese, 2-piece, tactile alignment)
- **Output schema**:
  ```
  {
    puzzle_categories: [
      {
        name: string,
        historical_context: string,
        two_piece_variants: [
          {
            name: string,
            tactile_mechanism: string,
            description: string
          }
        ]
      }
    ],
    current_sources: [
      {
        type: "artisan" | "vendor",
        name: string,
        contact_info: string,
        specialties: [string],
        authenticity_notes: string
      }
    ]
  }
  ```
- **Invariant**: Each category must have at least one documented 2-piece variant

## 6. File-by-file implementation plan

**research_report.md**
- Purpose: Main deliverable document
- Structure: Executive summary, category breakdown, sourcing section
- Key sections: Historical context, 2-piece analysis, current availability

**source_database.json**
- Purpose: Structured data for vendors/artisans
- Schema: Contact details, specialties, authenticity verification
- Validation: Active contact verification

**category_analysis.md**
- Purpose: Detailed breakdown of each puzzle category
- Content: Historical background, mechanism types, 2-piece variants
- Cross-references: Links between categories and tactile principles

## 7. Build order
1. **Initial source identification** - Locate academic papers, museum collections, Japanese craft references
2. **Category mapping** - Identify major traditional puzzle categories (Karakuri, etc.)
3. **2-piece variant research** - Within each category, find 2-piece examples
4. **Tactile mechanism analysis** - Document alignment principles for each variant
5. **Current maker identification** - Research active artisans and vendors
6. **Contact verification** - Validate current availability and authenticity
7. **Report compilation** - Synthesize findings into structured deliverable

## 8. Acceptance tests
- Report identifies minimum 3 traditional Japanese puzzle categories
- Documents at least 2 confirmed 2-piece variants with tactile alignment
- Provides verified contact information for 2+ active makers/vendors
- Each puzzle variant includes clear description of tactile mechanism
- Historical context provided for each category
- Authenticity verification notes for all recommended sources

## 9. Risks, assumptions, and rollback

**Open assumptions:**
1. Current artisan makers exist and are discoverable through online research
2. 2-piece variants exist within traditional categories (not just theoretical)

**Risk hotspots:**
- Language barrier accessing Japanese-only sources
- Authenticity verification of claimed "traditional" makers
- Limited documentation of historical 2-piece variants

**Rollback plan:**
- If <2 current makers found: Expand to include historical makers with modern availability
- If <2 2-piece variants found: Include near-variants (3-piece with 2-piece solving core)

## 10. Escalate instead of guessing
- **STOP_AND_ASK** if no 2-piece variants found in any traditional category
- **STOP_AND_ASK** if all discovered "artisan" sources appear to be mass manufacturers
- **STOP_AND_ASK** if research suggests tactile alignment is not a traditional Japanese puzzle principle
- **STOP_AND_ASK** if access to Japanese-language sources becomes critical blocker