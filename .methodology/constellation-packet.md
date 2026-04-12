@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: READY
@@CONFIDENCE: MEDIUM
@@OPEN_DECISIONS: 0
@@OPEN_ASSUMPTIONS: 3
@@END_HEADER

# Constellation Packet

## 1. Objective
- **Problem**: Need an evidence-based scoring framework to evaluate skill toys for ADHD attention anchoring across multiple dimensions (discretion, progression, resistance, meeting-safety, attention outcomes)
- **Desired outcome**: A reproducible scoring matrix that incorporates academic research, community insights, and practitioner knowledge with appropriate weighting for dual-mode usage
- **Success checks**: Framework produces consistent scores across evaluators, identifies research gaps, integrates Sarver 2015 findings

## 2. In scope / Out of scope

**In scope:**
- Evidence collection and quality assessment system
- Scoring matrix with 5 dimensions (discretion, progression, resistance, meeting-safety, ADHD attention outcomes)
- Academic research integration (starting with Sarver 2015)
- Community documentation synthesis
- Practitioner insight incorporation
- Dual-mode weighting system
- Research gap identification

**Out of scope:**
- Toy selection or procurement
- Clinical validation studies
- User interface development
- Automated scoring implementation
- Real-world testing protocols

## 3. Source-of-truth constraints
- Framework must be objective and reproducible
- Must incorporate Sarver 2015 as foundational research
- Scoring must weight appropriately for dual-mode requirement
- Evidence quality assessment required for all sources
- Research gaps must be explicitly documented

## 4. Architecture and flow
- **Components**: Evidence Database, Scoring Matrix, Weighting System, Gap Analysis
- **Data flow**: Research Collection → Quality Assessment → Categorization → Matrix Population → Weight Application → Gap Identification
- **State transitions**: Raw Evidence → Assessed Evidence → Categorized Evidence → Scored Evidence → Weighted Results
- **External dependencies**: Academic database access, community forums, practitioner networks

## 5. Contracts and invariants
- **Evidence Entry Schema**: source_type, quality_rating, dimension_relevance, finding_summary, confidence_level
- **Scoring Matrix Schema**: toy_id, discretion_score, progression_score, resistance_score, safety_score, attention_score, weighted_total
- **Quality Standards**: All evidence must have quality rating 1-5, source citation, and relevance mapping
- **Weighting Rules**: Dual-mode weights must sum to 1.0 per dimension

## 6. File-by-file implementation plan

**evidence_database.py**
- Purpose: Store and manage all research evidence
- Change required: Create from scratch
- Key functions: add_evidence(), assess_quality(), categorize_by_dimension()

**scoring_matrix.py**
- Purpose: Core scoring framework and calculations
- Change required: Create from scratch  
- Key functions: calculate_dimension_scores(), apply_weights(), generate_total_score()

**research_integration.py**
- Purpose: Process academic sources, starting with Sarver 2015
- Change required: Create from scratch
- Key functions: parse_sarver_2015(), extract_findings(), map_to_dimensions()

**community_synthesis.py**
- Purpose: Collect and process community documentation
- Change required: Create from scratch
- Key functions: scrape_forums(), categorize_insights(), validate_claims()

**gap_analysis.py**
- Purpose: Identify research gaps and evidence weaknesses
- Change required: Create from scratch
- Key functions: analyze_coverage(), identify_gaps(), prioritize_needs()

**weighting_system.py**
- Purpose: Manage dual-mode weights and dimension balancing
- Change required: Create from scratch
- Key functions: set_weights(), validate_weights(), apply_mode_adjustments()

## 7. Build order
1. Set up evidence_database.py with schema and basic CRUD operations
2. Implement research_integration.py to process Sarver 2015
3. Build scoring_matrix.py core calculation engine
4. Develop weighting_system.py for dual-mode support
5. Create community_synthesis.py for broader evidence collection
6. Implement gap_analysis.py for completeness assessment
7. Integration testing and validation across all components

## 8. Acceptance tests
- Framework produces identical scores for same toy when evaluated by different users
- Sarver 2015 findings are correctly integrated and weighted
- All 5 dimensions (discretion, progression, resistance, safety, attention) are scorable
- Dual-mode weighting produces different but valid total scores
- Research gaps are identified with specific recommendations
- Quality ratings correlate with evidence reliability

## 9. Risks, assumptions, and rollback

**Open assumptions:**
1. Sarver 2015 findings are directly applicable to skill toy evaluation
2. Community insights can be objectively validated and weighted
3. Dual-mode weighting can be determined without additional user research

**Risk hotspots:**
- Academic research may be too sparse for reliable scoring
- Community evidence quality may be inconsistent
- Practitioner access may be limited

**Rollback plan:**
If evidence proves insufficient, fall back to literature review only with explicit uncertainty ranges

## 10. Escalate instead of guessing
- If Sarver 2015 findings don't map clearly to the 5 dimensions: STOP_AND_ASK
- If community evidence quality is too poor to include: STOP_AND_ASK  
- If dual-mode weighting requires user preference data not available: STOP_AND_ASK
- If fewer than 3 academic sources can be located: STOP_AND_ASK
- If dimension definitions prove ambiguous during implementation: STOP_AND_ASK