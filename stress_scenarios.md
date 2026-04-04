# Stress Testing Scenarios
## High-Cognitive-Load Usability Testing for Stress-Resilient Financial UX

**Purpose:** Define realistic high-stress scenarios for usability testing. Each scenario simulates a cognitive/emotional state in which the user must complete financial tasks. Scenarios are used both for design validation and for [CRISIS]-marked items in the implementation checklist.

**Testing principles:**
- Test with actual users when possible; proxy simulation when not
- Never tell a test user what to do — observe whether they can independently navigate
- Record time, errors, abandonment events, and emotional cues (hesitation, frustration)
- A scenario PASSES if user completes core tasks without assistance

---

## Scenario SC-01: Cognitive Load Simulation Protocol

**Purpose:** Standard protocol for testing [CRISIS]-marked checklist items. Used to simulate reduced cognitive capacity without inducing real distress.

**Setup (research-based cognitive load induction):**
1. Ask participant to perform a concurrent verbal task: count backwards from 200 by 7s aloud throughout the test
2. Simultaneously present the app task
3. This dual-task paradigm reduces available working memory by approximately 30-40% (Baddeley, 2000)

**Alternative (if verbal task too disruptive):**
1. Give participant a list of 5 random words to memorize before starting
2. Ask them to recall the words after completing the task
3. The memory maintenance occupies working memory during task performance

**Baseline:** Run each task without cognitive load first to establish baseline performance. [CRISIS] pass threshold is task completion with cognitive load active.

**Task set for SC-01:**
- Task A: Find your runway number
- Task B: Record an expense of $47
- Task C: Check the most recent transaction

**Pass criteria:** All three tasks completed without verbal assistance, regardless of time taken.

---

## Scenario SC-02: ADHD Hyperfocus/Avoidance — Return After Gap

**Context:** User with ADHD has not opened the app in 3 weeks. This is a typical avoidance phase break. The user returns because they need to know how long their money will last.

**Simulated state:** User feels mild shame about the gap, anticipates the app will "feel broken" or have too much to catch up on. Low motivation, moderate anxiety.

**Primary need:** Know runway without feeling punished for the absence.

**Test tasks:**
1. Open app after 3-week simulated gap (tester has not used app in 3+ days as proxy)
2. Find runway number
3. Add one expense that occurred "while away" without back-filling the gap

**Failure indicators:**
- User encounters "you haven't used this in X days" or equivalent messaging → FM-A08 fail
- App is in an error or "incomplete" state due to data gap → FM-A08 fail
- User feels they must back-fill all missing data before getting runway info → FM-A03 fail
- User cannot add single transaction without addressing the gap → FM-A03 fail

**Pass criteria:** User gets runway number within 30 seconds of opening; adds one expense without gap remediation required.

**Design verification:** This scenario validates Principle 6 (Graceful Degradation).

---

## Scenario SC-03: RSD Trigger — Financial State Shame

**Context:** User has unexpectedly low runway (7 days). This is a scenario where alarm-based design would trigger Rejection Sensitivity Dysphoria.

**Simulated state:** User is already aware money is tight. Opening the app to check runway carries anticipatory anxiety. If the UI responds with alarm language or colors, user will close app and not return.

**Primary need:** Get accurate runway information without triggering emotional shutdown.

**Test tasks:**
1. Open app in configured low-runway state (7 days)
2. Record that state emotionally: note immediate visual impression and any emotional response
3. Add an income item
4. Recheck runway

**Failure indicators:**
- User reports feeling "attacked," "scolded," or "panicked" by app UI → FM-A07 fail
- User closes app without completing all tasks → FM-A07, FM-S05 fail
- Red/alarm colors present in UI state → Principle 9 fail
- Language uses "danger," "critical," "warning," or similar → Principle 4 fail

**Pass criteria:** User completes all tasks; reports UI felt calm and usable even with low runway; no alarm patterns triggered.

**Design verification:** Validates Principle 4 (Trauma-Safe Language) and Principle 9 (Calm Visual Design).

---

## Scenario SC-04: Post-Abuse Hypervigilance — Save Uncertainty

**Context:** User with financial abuse history needs to be certain a transaction was saved. The uncertainty of "did it save?" is a hypervigilance trigger that causes repeated re-entry and exhaustion.

**Simulated state:** User is in a verify-and-re-verify mode. They entered a transaction but are not confident it saved. They need clear confirmation without having to navigate away and back.

**Primary need:** Definitive, clear confirmation that entry was saved. The confirmation must be unmistakable.

**Test tasks:**
1. Enter a transaction
2. Identify whether it saved (without navigating away from entry screen)
3. Navigate to transaction list and confirm entry is present
4. Close and reopen app, confirm entry is still present

**Failure indicators:**
- Unclear save confirmation (ambiguous "success" state) → FM-T02 fail
- User navigates away unsure if it saved → FM-T02 fail
- Entry not present in list after apparent save → FM-T05 fail
- Entry missing after app reopen → FM-T05 fail

**Pass criteria:** User achieves certainty that transaction was saved without re-entry; entry persists across navigation and app restart.

**Design verification:** Validates Principle 7 (Predictability) and FM-T02 (Hypervigilance — Verification Compulsion).

---

## Scenario SC-05: Coercive Control Echo — Required Actions

**Context:** User needs runway info but app presents a required action before delivery (e.g., "complete your profile," "set a budget goal," "connect your bank account").

**Simulated state:** Any system demand triggers a fight/flight/freeze/fawn response in trauma survivors. Required actions feel like ultimatums — comply or escape.

**Primary need:** Access financial information without completing any setup task.

**Test tasks:**
1. Open fresh install of app (no account, no data entered)
2. Attempt to access runway without completing any setup
3. Attempt to record an expense without completing any setup

**Failure indicators:**
- App blocks access to runway without account setup → FM-T06 fail
- App requires "goals" or "budgets" before showing data → FM-T06, FM-T07 fail
- Required fields block transaction entry → FM-T06 fail
- Nag screens or popups interrupt primary task flow → FM-T06 fail

**Pass criteria:** User accesses runway (or sees "no data yet" state) and records a transaction without completing any required setup steps.

**Design verification:** Validates Principle 5 (Zero-Requirement Entry) and Principle 6 (Graceful Degradation at 0% engagement).

---

## Scenario SC-06: Acute Crisis — Divorce/Legal Proceedings

**Context:** User is in the middle of active legal proceedings for divorce. They need to quickly check their financial runway before a call with their attorney. They have approximately 3 minutes and are in a high-anxiety state.

**Simulated state:** Time pressure, high cortisol, tunnel vision likely, cognitive capacity significantly reduced. Need accurate information quickly with no fumbling.

**Primary need:** Runway number, current balance, and recent 3 transactions — in under 60 seconds.

**Test tasks (timed):**
1. Open app — get runway number (target: 10 seconds)
2. Get current balance (target: 5 seconds additional)
3. View last 3 transactions (target: 15 seconds additional)

**Failure indicators:**
- Any task exceeds 3× target time → FM-S01 fail
- User cannot find any information without navigation → FM-S02 fail
- User makes an error due to interface complexity → FM-S01, FM-S03 fail
- User expresses frustration or closes app before completing tasks → design fail

**Pass criteria:** All three tasks completed within 90 seconds total, without errors, starting from app launch.

**Design verification:** Validates Principle 3 (Runway First), Principle 1 (Single Answer), SC-01 cognitive load protocol.

---

## Scenario SC-07: Combined State — ADHD + Trauma + Crisis

**Context:** Hardest-case scenario. User has ADHD and trauma history, is in an acute stress state (e.g., unexpected large expense just occurred), and has not used the app in 10 days. They need to know if they can afford an emergency expense.

**Simulated state:** Maximum impairment. Executive function degraded by ADHD + acute stress. Shame about data gap. Trauma response may be active (hypervigilance or avoidance). Time pressure.

**Primary need:** Can they use this app right now to make a decision?

**Test tasks:**
1. Activate crisis mode
2. In crisis mode: find runway
3. In crisis mode: record an emergency expense
4. In crisis mode: determine if runway changed in expected direction

**Failure indicators:**
- User cannot activate crisis mode → CM-01 fail
- Crisis mode shows more than 3 elements → CM-02 fail
- User gives up at any point → design failure in combined state
- User makes error they cannot recover from → Principle 2 fail

**Pass criteria:** User completes all 4 tasks in crisis mode without assistance. User reports app was "usable" or "helped" despite high stress.

**Design verification:** Validates crisis mode design, intersection of all principles.

---

## Scenario SC-08: Privacy Threat — Monitoring Concern

**Context:** User is in divorce proceedings and concerned their financial data could be accessed by the other party. They need to understand exactly what data the app holds and be able to export or delete it for legal proceedings.

**Simulated state:** Fear and hypervigilance about data exposure. Need for control and clarity about privacy. May be operating under legal advice to document financial data.

**Primary need:** Export data, understand what is stored, and if needed, delete it.

**Test tasks:**
1. Find the privacy/data explanation (what is stored locally vs. cloud)
2. Export all financial data
3. Understand how to delete all data if needed
4. Locate the delete option (without executing it)

**Failure indicators:**
- Privacy explanation not findable in ≤3 taps → PD-02 fail
- Data export not available or confusing → PD-01 fail
- Export format not usable (e.g., opaque binary) → practical fail
- Delete option not present or no recovery window → PD-03 fail

**Pass criteria:** User completes all 4 tasks within 5 minutes without assistance. User can accurately explain what the app stores after completing tasks.

**Design verification:** Validates Principle 8 (Privacy as Safety).

---

## Testing Protocol Summary

| Scenario | Primary population | Cognitive load | Time pressure | Core principle tested |
|----------|-------------------|----------------|---------------|----------------------|
| SC-01 | All users | Artificial dual-task | No | [CRISIS] baseline |
| SC-02 | ADHD | Shame/avoidance | No | Graceful degradation |
| SC-03 | ADHD+RSD | Shame/anxiety | No | Calm language/visual |
| SC-04 | Trauma/abuse | Hypervigilance | No | Predictability/save |
| SC-05 | Trauma/abuse | Fear response | No | Zero-requirement |
| SC-06 | All | Acute stress | Yes (3 min) | Runway first |
| SC-07 | ADHD+Trauma | Maximum | Yes | Crisis mode |
| SC-08 | Trauma/abuse | Hypervigilance | No | Privacy as safety |

**Minimum testing requirement before release:**
- SC-01 must pass (validates [CRISIS] checklist items)
- SC-06 must pass (validates primary use case under stress)
- SC-07 must pass (validates worst-case combined state)

**Recommended full testing:**
All scenarios with at least 3 users per scenario for meaningful signal.
