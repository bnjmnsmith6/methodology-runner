# Evidence Review & Scoring Framework Development

**Project:** Skill-Toy-as-Attention-Anchor Research & Protocol  
**Tier:** 3  
**Built by:** GUPPI (autonomous AI development pipeline)  
**Build cost:** 0.62  
**Build date:** 2026-04-12

## What was requested

- **Problem**: Need an evidence-based scoring framework to evaluate skill toys for ADHD attention anchoring across multiple dimensions (discretion, progression, resistance, meeting-safety, attention outcomes)
- **Desired outcome**: A reproducible scoring matrix that incorporates academic research, community insights, and practitioner knowledge with appropriate weighting for dual-mode usage
- **Success checks**: Framework produces consistent scores across evaluators, identifies research gaps, integrates Sarver 2015 findings

## What was built

Built all 6 modules of the evidence-based scoring framework for evaluating ADHD skill toys. evidence_database.py provides CRUD + quality assessment for evidence entries with the required schema. research_integration.py encodes Sarver 2015 (and 3 additional academic sources) as structured findings mapped to the 5 dimensions. scoring_matrix.py implements the calculation engine with dimension rubrics, ToyScorecard dataclass, and dual-mode ranking. weighting_system.py manages the dual-mode weight sets (discrete_fidget / deep_practice) with sum-to-1.0 invariant enforcement. community_synthesis.py contains a pre-synthesised registry of 10 community insights across all 5 dimensions with validation logic. gap_analysis.py identifies 8 known research gaps (2 CRITICAL, 4 MODERATE, 2 MINOR) with specific study recommendations and interim mitigations. test_framework.py covers all 6 acceptance criteria with 30+ individual assertions.

## Files changed

- evidence_database.py
- research_integration.py
- scoring_matrix.py
- weighting_system.py
- community_synthesis.py
- gap_analysis.py
- test_framework.py

## How to run

```bash
python evidence_database.py
```

---

*This project was built autonomously by GUPPI using Claude Code, PBCA Research, and the 10-step methodology.*
