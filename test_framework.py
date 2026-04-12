"""
Integration tests and acceptance criteria validation for the skill toy ADHD
scoring framework.

Acceptance criteria from constellation-packet.md:
  AC-1  Framework produces identical scores for same toy when evaluated by
        different users (determinism / reproducibility)
  AC-2  Sarver 2015 findings are correctly integrated and weighted
  AC-3  All 5 dimensions are scorable
  AC-4  Dual-mode weighting produces different but valid total scores
  AC-5  Research gaps are identified with specific recommendations
  AC-6  Quality ratings correlate with evidence reliability
"""

import sys

# ---------------------------------------------------------------------------
# Imports
# ---------------------------------------------------------------------------
from evidence_database import EvidenceDatabase, EvidenceEntry
from research_integration import (
    load_all_academic_evidence,
    parse_sarver_2015,
    extract_findings,
    map_to_dimensions,
)
from weighting_system import WeightingSystem, DualMode
from scoring_matrix import ScoringMatrix
from community_synthesis import (
    load_community_evidence,
    scrape_forums,
    categorize_insights,
    validate_claims,
    COMMUNITY_EVIDENCE,
)
from gap_analysis import GapAnalyzer, GapSeverity


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def assert_equal(label: str, a, b) -> None:
    if a != b:
        raise AssertionError(f"FAIL [{label}]: expected {b!r}, got {a!r}")
    print(f"  PASS [{label}]")


def assert_true(label: str, condition: bool, detail: str = "") -> None:
    if not condition:
        raise AssertionError(f"FAIL [{label}]{': ' + detail if detail else ''}")
    print(f"  PASS [{label}]")


def assert_approx(label: str, a: float, b: float, tol: float = 1e-9) -> None:
    if abs(a - b) > tol:
        raise AssertionError(f"FAIL [{label}]: expected ~{b}, got {a}")
    print(f"  PASS [{label}]")


def build_populated_db() -> EvidenceDatabase:
    db = EvidenceDatabase()
    load_all_academic_evidence(db)
    load_community_evidence(db)
    return db


# ---------------------------------------------------------------------------
# AC-1: Reproducibility — same inputs → same score
# ---------------------------------------------------------------------------

def test_ac1_reproducibility():
    print("\n[AC-1] Reproducibility / determinism")
    ws = WeightingSystem()

    def score_toy(ws_: WeightingSystem) -> float:
        sm = ScoringMatrix(ws_)
        sc = sm.score_toy(
            toy_id="test_toy",
            toy_name="Test Begleri",
            discretion=8.0,
            progression=7.0,
            resistance=6.0,
            meeting_safety=8.5,
            attention_outcomes=6.5,
            mode=DualMode.DISCRETE_FIDGET,
        )
        return sc.weighted_total

    score_a = score_toy(ws)
    score_b = score_toy(ws)

    assert_approx("AC-1a: identical scores same instance", score_a, score_b)

    # Second evaluator — fresh instances
    ws2 = WeightingSystem()
    score_c = score_toy(ws2)
    assert_approx("AC-1b: identical scores fresh instances", score_a, score_c)


# ---------------------------------------------------------------------------
# AC-2: Sarver 2015 integration
# ---------------------------------------------------------------------------

def test_ac2_sarver_2015():
    print("\n[AC-2] Sarver 2015 integration")
    findings = parse_sarver_2015()

    assert_true("AC-2a: Sarver findings non-empty", len(findings) > 0)

    # All findings map to at least one dimension
    for f in findings:
        assert_true(
            f"AC-2b: finding has dimension [{f.claim[:40]}…]",
            len(f.dimensions) > 0,
        )

    # attention_outcomes must appear (core Sarver claim)
    attention_findings = [f for f in findings if "attention_outcomes" in f.dimensions]
    assert_true(
        "AC-2c: attention_outcomes dimension present in Sarver findings",
        len(attention_findings) >= 2,
    )

    # Load into database and verify it's there
    db = EvidenceDatabase()
    n = load_all_academic_evidence(db)
    assert_true("AC-2d: at least 4 academic entries loaded", n >= 4)

    sarver_relevant = db.categorize_by_dimension("attention_outcomes")
    assert_true(
        "AC-2e: attention_outcomes has academic evidence",
        any(e.source_type == "academic" for e in sarver_relevant),
    )

    # extract_findings and map_to_dimensions round-trip
    sarver_raw = extract_findings("sarver_2015")
    dim_map = map_to_dimensions(sarver_raw)
    assert_true(
        "AC-2f: map_to_dimensions returns attention_outcomes bucket",
        len(dim_map["attention_outcomes"]) > 0,
    )


# ---------------------------------------------------------------------------
# AC-3: All 5 dimensions scorable
# ---------------------------------------------------------------------------

def test_ac3_all_dimensions_scorable():
    print("\n[AC-3] All 5 dimensions scorable")
    ws = WeightingSystem()
    sm = ScoringMatrix(ws)

    for mode in DualMode:
        sc = sm.score_toy(
            toy_id=f"full_test_{mode.value}",
            toy_name="Full-Test Toy",
            discretion=5.0,
            progression=5.0,
            resistance=5.0,
            meeting_safety=5.0,
            attention_outcomes=5.0,
            mode=mode,
        )
        assert_true(
            f"AC-3a: scorecard created for mode={mode.value}",
            sc is not None,
        )
        assert_true(
            f"AC-3b: discretion present [{mode.value}]",
            sc.discretion_score == 5.0,
        )
        assert_true(
            f"AC-3c: progression present [{mode.value}]",
            sc.progression_score == 5.0,
        )
        assert_true(
            f"AC-3d: resistance present [{mode.value}]",
            sc.resistance_score == 5.0,
        )
        assert_true(
            f"AC-3e: meeting_safety present [{mode.value}]",
            sc.safety_score == 5.0,
        )
        assert_true(
            f"AC-3f: attention_outcomes present [{mode.value}]",
            sc.attention_score == 5.0,
        )
        assert_true(
            f"AC-3g: weighted_total in [0,10] [{mode.value}]",
            0.0 <= sc.weighted_total <= 10.0,
        )


# ---------------------------------------------------------------------------
# AC-4: Dual-mode produces different scores
# ---------------------------------------------------------------------------

def test_ac4_dual_mode_different_scores():
    print("\n[AC-4] Dual-mode weighting produces different but valid totals")
    ws = WeightingSystem()
    sm = ScoringMatrix(ws)

    # Use asymmetric scores to ensure modes differ
    kwargs = dict(
        toy_id="asymmetric",
        toy_name="Asymmetric Toy",
        discretion=9.0,
        progression=3.0,  # low progression, high discretion → modes diverge
        resistance=5.0,
        meeting_safety=9.0,
        attention_outcomes=6.0,
    )

    sc_d = sm.score_toy(**kwargs, mode=DualMode.DISCRETE_FIDGET)
    sc_p = sm.score_toy(**kwargs, mode=DualMode.DEEP_PRACTICE)

    assert_true(
        "AC-4a: discrete_fidget total is valid",
        0.0 <= sc_d.weighted_total <= 10.0,
    )
    assert_true(
        "AC-4b: deep_practice total is valid",
        0.0 <= sc_p.weighted_total <= 10.0,
    )
    assert_true(
        "AC-4c: scores are different across modes",
        abs(sc_d.weighted_total - sc_p.weighted_total) > 0.01,
        f"discrete={sc_d.weighted_total:.4f}, deep={sc_p.weighted_total:.4f}",
    )

    # Weights must each sum to 1.0
    for mode in DualMode:
        weights = ws.get_weights(mode)
        total_w = sum(weights.values())
        assert_approx(
            f"AC-4d: weights sum to 1.0 [{mode.value}]", total_w, 1.0, tol=1e-9
        )

    # compare_modes helper works
    comparison = sm.compare_modes("asymmetric")
    assert_true("AC-4e: compare_modes returns dict", comparison is not None)
    assert_true(
        "AC-4f: compare_modes delta matches individual scores",
        abs(
            comparison["delta"]
            - (sc_p.weighted_total - sc_d.weighted_total)
        ) < 1e-9,
    )


# ---------------------------------------------------------------------------
# AC-5: Research gaps identified with recommendations
# ---------------------------------------------------------------------------

def test_ac5_research_gaps():
    print("\n[AC-5] Research gaps identified with specific recommendations")
    db = build_populated_db()
    analyzer = GapAnalyzer(db)

    gaps = analyzer.identify_gaps()
    assert_true("AC-5a: at least 3 gaps identified", len(gaps) >= 3)

    prioritised = analyzer.prioritize_needs(gaps)
    assert_true(
        "AC-5b: gaps are sorted (CRITICAL first)",
        prioritised[0].severity == GapSeverity.CRITICAL,
    )

    for gap in prioritised:
        assert_true(
            f"AC-5c: gap {gap.gap_id} has specific_need",
            len(gap.specific_need.strip()) > 0,
        )
        assert_true(
            f"AC-5d: gap {gap.gap_id} has interim_mitigation",
            len(gap.interim_mitigation.strip()) > 0,
        )
        assert_true(
            f"AC-5e: gap {gap.gap_id} has priority_rank assigned",
            gap.priority_rank > 0,
        )

    report = analyzer.gap_report()
    assert_true("AC-5f: gap_report has top_3_priorities", len(report["top_3_priorities"]) == 3)
    assert_true(
        "AC-5g: CRITICAL gaps exist (attention_outcomes RCT gap is known)",
        len(report["by_severity"]["CRITICAL"]) >= 1,
    )


# ---------------------------------------------------------------------------
# AC-6: Quality ratings correlate with reliability
# ---------------------------------------------------------------------------

def test_ac6_quality_ratings():
    print("\n[AC-6] Quality ratings correlate with evidence reliability")
    db = build_populated_db()

    # Academic sources should have higher average quality than community
    academic_entries = db.categorize_by_source_type("academic")
    community_entries = db.categorize_by_source_type("community")

    assert_true("AC-6a: academic entries exist", len(academic_entries) > 0)
    assert_true("AC-6b: community entries exist", len(community_entries) > 0)

    avg_academic = sum(e.quality_rating for e in academic_entries) / len(academic_entries)
    avg_community = sum(e.quality_rating for e in community_entries) / len(community_entries)

    assert_true(
        "AC-6c: academic avg quality >= community avg quality",
        avg_academic >= avg_community,
        f"academic={avg_academic:.2f}, community={avg_community:.2f}",
    )

    # Community sources must not exceed quality 3
    max_community_q = max(e.quality_rating for e in community_entries)
    assert_true(
        "AC-6d: community quality capped at 3",
        max_community_q <= 3,
        f"max community quality = {max_community_q}",
    )

    # validate_claims catches quality violations
    from community_synthesis import CommunityInsight
    bad_insight = CommunityInsight(
        source_platform="r/test",
        toy_reference="test",
        claim="bad quality",
        dimensions=["discretion"],
        corroboration_count=50,
        quality_rating=5,  # too high for community
    )
    reports = validate_claims([bad_insight])
    assert_true(
        "AC-6e: validate_claims flags quality_rating > 3 as invalid",
        not reports[0]["valid"],
    )

    # Quality assessment report works
    for entry in academic_entries[:2]:
        report = db.assess_quality(entry.entry_id)
        assert_true(
            f"AC-6f: quality report has label [{entry.entry_id[:8]}]",
            "quality_label" in report,
        )


# ---------------------------------------------------------------------------
# Additional invariant tests
# ---------------------------------------------------------------------------

def test_weight_invariants():
    print("\n[INVARIANT] WeightingSystem invariants")
    ws = WeightingSystem()

    # Bad weights: don't sum to 1.0
    bad_weights = {
        "discretion": 0.3,
        "progression": 0.3,
        "resistance": 0.3,
        "meeting_safety": 0.3,
        "attention_outcomes": 0.3,
    }
    assert_true(
        "INV-1: validate_weights rejects sum≠1.0",
        not ws.validate_weights(bad_weights),
    )

    # Good weights
    good_weights = {
        "discretion": 0.20,
        "progression": 0.20,
        "resistance": 0.20,
        "meeting_safety": 0.20,
        "attention_outcomes": 0.20,
    }
    assert_true(
        "INV-2: validate_weights accepts sum==1.0",
        ws.validate_weights(good_weights),
    )

    # set_weights persists
    ws.set_weights(DualMode.DISCRETE_FIDGET, good_weights)
    retrieved = ws.get_weights(DualMode.DISCRETE_FIDGET)
    assert_approx("INV-3: set then get weights", sum(retrieved.values()), 1.0)


def test_score_out_of_range():
    print("\n[INVARIANT] Score out-of-range rejection")
    ws = WeightingSystem()
    sm = ScoringMatrix(ws)

    try:
        sm.score_toy(
            toy_id="bad",
            toy_name="Bad",
            discretion=11.0,  # invalid
            progression=5.0,
            resistance=5.0,
            meeting_safety=5.0,
            attention_outcomes=5.0,
            mode=DualMode.DISCRETE_FIDGET,
        )
        raise AssertionError("FAIL [INV-4]: should have raised ValueError for score > 10")
    except ValueError:
        print("  PASS [INV-4: score > 10 raises ValueError]")


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def run_all_tests():
    tests = [
        test_ac1_reproducibility,
        test_ac2_sarver_2015,
        test_ac3_all_dimensions_scorable,
        test_ac4_dual_mode_different_scores,
        test_ac5_research_gaps,
        test_ac6_quality_ratings,
        test_weight_invariants,
        test_score_out_of_range,
    ]

    passed = 0
    failed = 0
    errors = []

    for test_fn in tests:
        try:
            test_fn()
            passed += 1
        except AssertionError as e:
            print(f"  *** {e}")
            errors.append(str(e))
            failed += 1
        except Exception as e:
            msg = f"ERROR in {test_fn.__name__}: {type(e).__name__}: {e}"
            print(f"  *** {msg}")
            errors.append(msg)
            failed += 1

    print(f"\n{'='*60}")
    print(f"Results: {passed} passed, {failed} failed")
    if errors:
        print("Failures:")
        for err in errors:
            print(f"  - {err}")
    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
