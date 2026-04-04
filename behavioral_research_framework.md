# Behavioral Research & UX Safety Framework
## Stress-Resilient Financial Management for ADHD and Post-Abuse Recovery

**Version:** 1.0
**Date:** 2026-04-04
**Status:** Evidence-Based Framework

---

## Executive Summary

Financial management systems systematically fail users with ADHD and post-trauma profiles during high-stress periods — precisely when financial clarity matters most. This framework documents failure modes, derives UX safety principles, and provides concrete implementation guidelines for financial interfaces that remain functional when the user is emotionally or cognitively compromised.

The central design mandate: **the system must be maximally useful at the user's worst moment, not their best.**

---

## Part 1: Failure Mode Taxonomy

Failure modes are organized by primary cause. Many compound across categories in real-world use.

### 1.1 ADHD-Specific Failure Modes

**FM-A01: Time Blindness — Missed Payment Windows**
- **Mechanism:** ADHD impairs perception of time passing (Barkley, 2015). Users genuinely fail to perceive that a bill due "this week" is urgent.
- **UX Trigger:** Calendar-based due date displays, notification timing misaligned with attention peaks
- **Abandonment pattern:** User opens app, sees a past-due bill, experiences shame/overwhelm, closes app

**FM-A02: Working Memory Dropout Mid-Transaction**
- **Mechanism:** ADHD significantly degrades working memory capacity (Kasper et al., 2012). Users lose track of what they were entering during a multi-step form.
- **UX Trigger:** Multi-step transaction entry forms, no auto-save, session timeouts that clear input
- **Abandonment pattern:** User closes half-entered form; entry never gets recorded

**FM-A03: Hyperfocus/Avoidance Cycle**
- **Mechanism:** ADHD produces binary engagement states — intense focus or complete avoidance (Hallowell & Ratey, 2011). Financial systems get abandoned during avoidance phases.
- **UX Trigger:** Complex setup requirements before value delivery, high friction to resume after absence
- **Abandonment pattern:** Initial enthusiastic setup → avoidance phase → app feels "too behind to restart"

**FM-A04: Impulsive Entry and Regret**
- **Mechanism:** Impulsivity in ADHD extends to data entry — users tap quickly, confirm without reviewing (Barkley, 2015).
- **UX Trigger:** Irreversible actions with insufficient confirmation, no easy correction path
- **Abandonment pattern:** Wrong entry → correction feels too hard → user stops tracking

**FM-A05: Task Initiation Paralysis**
- **Mechanism:** ADHD impairs task initiation independent of desire or ability (Brown, 2013). The act of "opening the finance app" can feel insurmountable despite knowing it needs to happen.
- **UX Trigger:** App requires mental preparation to use (complex dashboard, decision-heavy home screen)
- **Abandonment pattern:** User intends to open app daily; actually opens it twice a month

**FM-A06: Decision Fatigue — Option Overload**
- **Mechanism:** Executive function deficits mean ADHD users exhaust decision capacity faster (Hess et al., 2019). Too many choices (categories, accounts, filters) cause shutdown.
- **UX Trigger:** Required category selection, multiple account views, configurable dashboards
- **Abandonment pattern:** User stares at category dropdown, closes app, never categorizes

**FM-A07: Rejection Sensitivity Dysphoria — Financial Shame Amplification**
- **Mechanism:** RSD in ADHD causes intense, disproportionate emotional responses to perceived failure (Dodson, 2016). A low balance or error message feels catastrophic.
- **UX Trigger:** Red warning colors, alarming language ("DANGER: Low funds"), visible failure counts
- **Abandonment pattern:** User sees alarming UI → emotional flooding → app associated with pain → stops using

**FM-A08: Inconsistent Habit Formation**
- **Mechanism:** Habit formation requires working memory and consistent execution — both impaired in ADHD (Mostert et al., 2017). Users cannot maintain daily tracking rituals.
- **UX Trigger:** Systems requiring daily input to maintain accuracy, no graceful degradation for gaps
- **Abandonment pattern:** Miss 3 days → data feels wrong → starting over feels impossible → quit

**FM-A09: Hypersensitivity to Interface Complexity**
- **Mechanism:** ADHD reduces signal-to-noise discrimination; complex interfaces generate high cognitive load from visual noise alone (Nigg, 2017).
- **UX Trigger:** Cluttered dashboards, multiple data visualizations, dense typography, animation
- **Abandonment pattern:** Open app → feel overwhelmed by visual information → close immediately

### 1.2 Post-Abuse / Trauma-Specific Failure Modes

**FM-T01: Financial Learned Helplessness**
- **Mechanism:** Prolonged financial abuse (controlling money access, punishing financial decisions) produces learned helplessness — the belief that financial actions have no reliable effect (Walker, 2017; Herman, 1992).
- **UX Trigger:** Financial "scoring" or judgment language, comparative benchmarks ("you spent 40% more than average")
- **Abandonment pattern:** User attempts action → outcome feels uncertain or controlled by system → stops trying

**FM-T02: Hypervigilance — Verification Compulsion**
- **Mechanism:** Abuse creates hypervigilance (Herman, 1992). Users re-check entries, doubt their inputs, verify and re-verify balances — which becomes exhausting and leads to avoidance.
- **UX Trigger:** System ambiguity about whether save succeeded, unclear confirmation states, sync uncertainty
- **Abandonment pattern:** User re-enters same transaction multiple times, exhausted, stops tracking

**FM-T03: Avoidance of Financial Information**
- **Mechanism:** Financial information was weaponized in abusive relationships — used to control, criticize, shame (Postmus, 2011). Accessing financial data triggers trauma responses.
- **UX Trigger:** Mandatory financial summary on open, no way to access a specific feature without seeing the full dashboard
- **Abandonment pattern:** User avoids opening app to avoid triggering anxiety about numbers

**FM-T04: Shame-Triggered Dissociation**
- **Mechanism:** Trauma responses include dissociation when triggered by shame-associated stimuli (van der Kolk, 2014). Financial stress is a primary trigger.
- **UX Trigger:** Error language framing user as incompetent ("You haven't logged anything in 14 days"), visible "failure" metrics
- **Abandonment pattern:** Shame trigger → dissociation → no memory of closing app → pattern repeats

**FM-T05: Distrust of System Reliability**
- **Mechanism:** Abuse erodes trust — including trust in tools (Herman, 1992). Users expect systems to fail them, lose their data, or "betray" them.
- **UX Trigger:** Any actual data loss, sync failures without clear recovery, opaque error states
- **Abandonment pattern:** Single data loss event → system fundamentally untrustworthy → abandonment

**FM-T06: Coercive Control Echoes — System-Initiated Demands**
- **Mechanism:** Coercive control trained users to respond to demands with anxiety and avoidance (Johnson, 2008). Push notifications, required actions, and "you must do this" UI patterns replicate abuse dynamics.
- **UX Trigger:** Mandatory onboarding steps, required fields, push notifications framed as demands, nag screens
- **Abandonment pattern:** System demands action → triggers compliance-or-escape response → user escapes

**FM-T07: Financial Identity Disruption**
- **Mechanism:** Abuse survivors often have no prior healthy financial self-concept — financial decisions were always controlled or criticized (Postmus, 2011). They lack confidence in their own judgment.
- **UX Trigger:** Systems requiring "goals," "budgets," or financial self-assessment to function
- **Abandonment pattern:** User cannot answer "what is your financial goal?" without anxiety → setup never completes

**FM-T08: Privacy Paranoia — Safety Conflict**
- **Mechanism:** Survivors may have had their financial accounts monitored or controlled (Postmus, 2011). Privacy of financial data feels existential, not preference.
- **UX Trigger:** Cloud sync without clear privacy controls, ambiguous data ownership, "share with advisor" features
- **Abandonment pattern:** User fears data exposure → disables sync → data loss → abandonment

### 1.3 Stress/Crisis-State Failure Modes

**FM-S01: Cognitive Load Overflow — Shutdown**
- **Mechanism:** Acute stress degrades prefrontal cortex function, reducing working memory and executive function (Arnsten, 2015). At sufficient stress, the brain cannot process complex interfaces.
- **UX Trigger:** Any interface requiring more than 2-3 steps to complete a primary action during crisis
- **Abandonment pattern:** User needs to check runway → interface too complex to navigate under stress → doesn't check → makes uninformed decision

**FM-S02: Tunnel Vision — Feature Discovery Failure**
- **Mechanism:** Stress-induced tunnel vision (attentional narrowing) causes users to fixate on one element and miss other interface components (Starcke & Brand, 2012).
- **UX Trigger:** Primary information not in the most visible position, features requiring navigation to find
- **Abandonment pattern:** User misses critical information that is "there but not prominent"

**FM-S03: Urgency-Driven Impulsivity**
- **Mechanism:** Stress increases impulsive decision-making and reduces risk assessment (Pabst et al., 2013). Crisis states make users more likely to take irreversible actions without review.
- **UX Trigger:** Irreversible actions without friction, financial decisions requiring immediate confirmation
- **Abandonment pattern:** User takes wrong action → cannot undo → data integrity lost → abandonment

**FM-S04: Memory Encoding Failure During Crisis**
- **Mechanism:** Acute stress impairs memory consolidation (McEwen & Sapolsky, 1995). Users cannot remember what they entered, what they checked, or whether they completed a task.
- **UX Trigger:** No persistent record of recent actions, no "last viewed" state, no completion confirmation
- **Abandonment pattern:** User doesn't know if they entered a transaction → enters twice or not at all → doubts data accuracy → stops tracking

**FM-S05: Catastrophizing — Single Error Generalization**
- **Mechanism:** Under stress, cognitive distortions amplify — a single mistake feels like total system failure (Beck, 1979). Particularly potent with ADHD-RSD and trauma backgrounds.
- **UX Trigger:** Error states that feel punishing, no reassurance that data is safe, no easy recovery path
- **Abandonment pattern:** One mistake → everything feels broken → app abandoned

**FM-S06: Sensory Overwhelm**
- **Mechanism:** High arousal states reduce sensory tolerance (van der Kolk, 2014). Visual complexity, animation, and information density become physically aversive.
- **UX Trigger:** Animated transitions, dense data visualization, high color contrast, multiple simultaneous information streams
- **Abandonment pattern:** App opens → visual complexity immediately aversive → closed immediately

---

## Part 2: UX Safety Principles

Each principle includes the behavioral basis and measurable implementation criteria.

### Principle 1: Single Answer Per Screen

**Statement:** Every screen answers exactly one question and provides exactly one primary action.

**Behavioral basis:** Reduces decision fatigue (FM-A06), reduces cognitive load overflow (FM-S01), reduces tunnel vision effects (FM-S02).

**Implementation criteria:**
- Maximum 1 primary call-to-action button per screen
- Dashboard shows maximum 3 data points
- Each navigation destination has a declarative question it answers (e.g., "How many days can I survive on current balance?")
- Pass criteria: User can state the purpose of any screen in ≤5 words

### Principle 2: Radical Forgiveness — Nothing is Permanent

**Statement:** Every action is reversible. No input is permanently lost. No mistake causes data loss.

**Behavioral basis:** Prevents impulsive entry regret loops (FM-A04), reduces distrust triggers (FM-T05), reduces catastrophizing after errors (FM-S05).

**Implementation criteria:**
- All transaction entries editable after save
- Soft-delete with 30-day recovery for all deletions
- Auto-save all partial inputs every 30 seconds
- No data loss on session timeout
- Undo available for all data modifications
- Pass criteria: Any action taken within the last 30 days can be reversed in ≤3 taps

### Principle 3: Runway First — One Number Dominates

**Statement:** The days-of-runway number is always the primary visible element. All other information is secondary.

**Behavioral basis:** Provides immediate orientation reducing cognitive load (FM-S01), gives tunnel-vision users the critical information (FM-S02), reduces avoidance by making value immediately visible (FM-A03, FM-T03).

**Implementation criteria:**
- Days of runway displayed in largest font element on home screen
- Runway visible without scrolling on all screen sizes ≥320px width
- Runway number updates within 2 seconds of any balance or expense change
- Color coding uses calm spectrum (not red/green alarm patterns)
- Pass criteria: User can state their runway within 5 seconds of opening the app

### Principle 4: Trauma-Safe Language

**Statement:** Interface language never assigns blame, urgency, or judgment. All states are described neutrally or positively.

**Behavioral basis:** Prevents shame-triggered dissociation (FM-T04), prevents RSD amplification (FM-A07), prevents coercive control echoes (FM-T06).

**Implementation criteria:**
- No words: "overdue," "missed," "failed," "danger," "warning," "must," "required," "you haven't"
- Balance states use neutral descriptors: "low," "building," "comfortable"
- Error messages describe what happened, not what the user did wrong
- Notifications are invitations, not demands ("Your runway is ready to review" not "You need to update your expenses")
- Pass criteria: Independent review of all interface copy finds zero blame/judgment language

### Principle 5: Zero-Requirement Entry

**Statement:** A transaction can be recorded with exactly one input: the amount. Everything else is optional, always.

**Behavioral basis:** Removes task initiation barriers (FM-A05), prevents decision fatigue from category selection (FM-A06), removes coercive demands (FM-T06).

**Implementation criteria:**
- Amount-only entry path available in ≤2 taps from home screen
- All fields except amount are optional with visible defaults
- Categories, notes, and dates all have smart defaults that activate without user action
- Pass criteria: User can record a transaction in ≤10 seconds from app open

### Principle 6: Graceful Degradation — Useful at 0% Engagement

**Statement:** The system provides value even when the user hasn't entered anything in weeks. Gaps are handled, not punished.

**Behavioral basis:** Prevents the "too far behind to restart" abandonment (FM-A03, FM-A08), reduces shame triggers around data gaps (FM-T04).

**Implementation criteria:**
- App provides runway estimate from bank balance alone (no expense entries required)
- No "you haven't used this in X days" messaging
- Data gaps treated as unknown, not errors — runway estimate shows confidence range
- Returning after absence shows welcome state, not "you have X things to catch up on"
- Pass criteria: App remains useful with only monthly data entry

### Principle 7: Predictability — No Surprises

**Statement:** The interface behaves identically every time. No adaptive UI, no dynamic reordering, no personalization that moves things.

**Behavioral basis:** Trauma survivors need environmental predictability (Herman, 1992). Hypervigilance is calmed by consistency (FM-T02). ADHD users rely on spatial memory for navigation (FM-A09).

**Implementation criteria:**
- Navigation items never change position based on usage
- No algorithmic reordering of any displayed content
- Home screen identical regardless of data state
- Pass criteria: User can navigate to any feature with eyes closed after 3 uses

### Principle 8: Privacy as Safety, Not Feature

**Statement:** Data privacy controls are prominent, simple, and always accessible. The user controls what exists and who can see it.

**Behavioral basis:** Addresses financial abuse survivors' safety needs (FM-T08), removes distrust triggers (FM-T05).

**Implementation criteria:**
- Data export available in ≤3 taps from home
- Clear statement of what data is stored locally vs. synced
- Delete all data option accessible from settings with simple recovery window
- No third-party data sharing, ever
- Pass criteria: User can explain their data privacy situation accurately after 5 minutes with app

### Principle 9: Calm Visual Language

**Statement:** Visual design uses low arousal, high clarity aesthetic. No alarm patterns, urgency signals, or high-contrast warning states.

**Behavioral basis:** Reduces sensory overwhelm in high-arousal states (FM-S06), prevents RSD amplification from alarming visuals (FM-A07), prevents trauma trigger from emergency-associated colors (FM-T04).

**Implementation criteria:**
- No red used except for critical errors (not for financial states)
- Maximum 3 colors in primary UI
- No animations on data elements (loading states may animate)
- Font size minimum 16px for all body content
- Information density: maximum 5 data points visible without scroll on home screen
- Pass criteria: App passes calm design audit (no alarm-associated patterns in primary user flows)

### Principle 10: Crisis Mode — Radical Simplification

**Statement:** A single gesture activates a maximum-simplicity mode showing only runway and one-tap transaction entry.

**Behavioral basis:** Addresses cognitive load overflow (FM-S01), sensory overwhelm (FM-S06), tunnel vision (FM-S02).

**Implementation criteria:**
- Crisis mode accessible in ≤1 tap from any screen
- Crisis mode shows: runway number, current balance, one "add expense" button
- Crisis mode hides all other interface elements
- Crisis mode persists until explicitly exited
- Pass criteria: User can complete core tasks in crisis mode under 50% cognitive load simulation

---

## Part 3: Component-Specific Design Guidelines

### 3.1 Transaction Entry

**Primary flow (required):**
1. Open entry from home (1 tap)
2. Enter amount (numeric keypad, immediate)
3. Confirm (1 tap)
Total: 3 taps, ≤10 seconds

**Auto-fill defaults:**
- Date: today
- Type: expense (most common)
- Category: "general" (no required selection)
- Account: primary account

**Error handling:**
- Duplicate detection: "This looks similar to an entry from today — is it a second transaction?" (never "you already entered this")
- Invalid amount: highlight field, no error message, allow correction
- All errors correctable inline without losing other input

**Persistence:**
- Auto-save on every keystroke after first character entered
- Partial entries survive app close and device restart
- Entry history accessible: "last 5 transactions" visible one tap from entry screen

### 3.2 Runway Visibility

**Calculation:**
- Primary: days until balance reaches $0 at current average burn rate
- Secondary: days until balance reaches user-defined comfort threshold
- Display: whole number (no decimals), no currency symbols in primary display

**Display states (calm color vocabulary):**
- Comfortable: calm blue/teal (60+ days)
- Building awareness: warm amber (20-60 days)
- Active attention needed: muted orange (10-20 days)
- Immediate focus: soft red (0-10 days) — not alarm red, not flashing

**Never display:**
- Negative runway (show "0 days" with "let's figure this out" prompt)
- Percentage-based health scores
- Comparison to previous periods without user request
- Color transitions that animate or pulse

**Context display:**
- Show confidence level ("based on X weeks of data" or "estimate — add expenses for accuracy")
- Show last-updated timestamp in small text below primary number

### 3.3 Navigation and Information Architecture

**Hierarchy depth:** Maximum 2 levels. All primary functions reachable in ≤2 taps.

**Primary navigation (always visible):**
1. Home (runway + quick entry)
2. Transactions (list + entry)
3. Settings (privacy, data, display)

**Information architecture principles:**
- No nested menus
- No hamburger menu for primary actions
- Back button always visible and functional
- Current location always visible (breadcrumb or title)

**Home screen information (maximum):**
- Runway number (primary)
- Balance (secondary)
- Recent transactions (last 3)
- One action button ("Add expense")

---

## Part 4: Stress-Testing Scenarios

See `stress_scenarios.md` for full scenario descriptions and testing protocols.

**Scenario categories covered:**
- ADHD crisis: task initiation paralysis simulation
- Trauma trigger: shame state navigation testing
- Acute stress: cognitive load reduction testing
- Combined state: ADHD + acute crisis + divorce proceedings

---

## Appendix A: Framework Validation Checklist

See `implementation_checklist.md` for binary pass/fail validation tool.

---

## Appendix B: Research Sources

See `research_sources.md` for complete bibliography with relevance annotations.
