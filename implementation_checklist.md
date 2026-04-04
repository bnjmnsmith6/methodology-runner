# Implementation Checklist
## Stress-Resilient Financial UX — Binary Pass/Fail Validation

**Purpose:** Developer-facing validation tool. Each item has a binary pass/fail result. A feature area is ready for release only when all items in its section pass.

**How to use:**
1. Test each item in an unguided session (no prompting of test user)
2. Mark PASS only if criterion met without assistance
3. Any FAIL item blocks release of the relevant feature area
4. Items marked [CRISIS] must also pass in a simulated cognitive load state (see stress_scenarios.md SC-01)

---

## Section 1: Transaction Entry

### 1.1 Minimum viable path

- [ ] **TE-01** User can record a transaction (amount only) in ≤10 seconds from app open, no prior instruction
  - Method: Time from app launch to transaction saved confirmation
  - PASS: ≤10 seconds, no assistance required
  - FAIL: >10 seconds, or user asks for help, or any required field blocks completion

- [ ] **TE-02** Transaction entry requires only amount — all other fields have defaults and are optional
  - Method: Attempt to save a transaction with only amount entered
  - PASS: Transaction saves successfully with amount only
  - FAIL: Any other field required or validation error appears

- [ ] **TE-03 [CRISIS]** Transaction entry path is reachable in ≤2 taps from home screen
  - Method: Count taps from home screen to transaction amount input field
  - PASS: ≤2 taps
  - FAIL: >2 taps, or requires navigation that changes each session

- [ ] **TE-04** Partial transaction entry survives app close without loss
  - Method: Enter amount, close app, reopen
  - PASS: Partial entry present and resumable
  - FAIL: Input cleared, no recovery option

- [ ] **TE-05** Every entered transaction is editable after save
  - Method: Save a transaction, locate it, modify amount and type
  - PASS: Edit succeeds, changes persist
  - FAIL: No edit option, or edit fails to save

- [ ] **TE-06** Deleted transactions are recoverable within 30 days
  - Method: Save then delete a transaction, locate recovery option
  - PASS: Deleted transaction accessible in recovery within 30 days
  - FAIL: No recovery option, or recovery window <30 days

- [ ] **TE-07** Duplicate transaction detected and handled non-judgmentally
  - Method: Enter same amount twice within 5 minutes
  - PASS: System surfaces gentle notice ("This looks similar to a recent entry"), user can confirm or dismiss
  - FAIL: No detection, or detection language is accusatory

- [ ] **TE-08** No session timeout that causes data loss during entry
  - Method: Open entry form, wait 30 minutes without interaction, return
  - PASS: Entry form open, all typed data present
  - FAIL: Session expired, data cleared

### 1.2 Error handling

- [ ] **TE-09** Invalid amount input handled without error message (visual feedback only)
  - Method: Enter non-numeric characters in amount field
  - PASS: Non-numeric input blocked or highlighted, no error message shown
  - FAIL: Error message displayed, especially with blame language

- [ ] **TE-10** No "you must" or "required" language in transaction entry flow
  - Method: Review all text in transaction entry screens
  - PASS: Zero instances of mandatory language
  - FAIL: Any instance of "required," "must," "you need to," or equivalent

---

## Section 2: Runway Visibility

### 2.1 Display requirements

- [ ] **RV-01 [CRISIS]** Runway number visible within 5 seconds of app open, no interaction required
  - Method: Time from app launch to readable runway number
  - PASS: ≤5 seconds, visible without scroll or interaction
  - FAIL: >5 seconds, requires scroll, or requires interaction to reveal

- [ ] **RV-02 [CRISIS]** Runway number is the largest text element on home screen
  - Method: Visual inspection of home screen
  - PASS: Runway number font size exceeds all other text on screen
  - FAIL: Any other text element equal or larger size

- [ ] **RV-03** Runway visible on all screen sizes ≥320px width without horizontal scroll
  - Method: Test on device with 320px width (or browser emulation)
  - PASS: Runway number fully visible, no horizontal scroll required
  - FAIL: Runway truncated, hidden, or requires scroll

- [ ] **RV-04** Runway updates within 2 seconds of any balance or expense change
  - Method: Add a transaction, time until runway number updates
  - PASS: ≤2 seconds
  - FAIL: >2 seconds, or no update until manual refresh

- [ ] **RV-05** Runway uses calm color vocabulary — no alarm red or flashing states
  - Method: Trigger each runway state (comfortable/building/active/immediate), inspect colors
  - PASS: No state uses alarm-red (#FF0000 ± 30° hue, >50% saturation) or animation
  - FAIL: Alarm red used for any financial state, or any runway element pulses/flashes

- [ ] **RV-06** Runway shows confidence indicator when data is sparse
  - Method: Use app with <1 week of expense history, check runway display
  - PASS: Confidence qualifier shown ("estimate" or similar), no false precision
  - FAIL: Runway shown as precise number with no confidence caveat when data is insufficient

- [ ] **RV-07** Runway never shows negative value
  - Method: Configure state where calculated runway would be negative
  - PASS: Shows "0 days" with non-alarming guidance prompt
  - FAIL: Shows negative number, or alarming/urgent language

### 2.2 Language validation

- [ ] **RV-08** Runway display contains no blame, judgment, or alarm language
  - Method: Review all text states in runway display component
  - PASS: Zero instances of "danger," "critical," "overdue," "failed," or equivalent
  - FAIL: Any alarm or blame language in runway component

---

## Section 3: Navigation and Information Architecture

### 3.1 Navigation depth

- [ ] **NAV-01 [CRISIS]** All primary functions reachable in ≤2 taps from home
  - Method: Navigate to: (1) add transaction, (2) view transactions, (3) settings/privacy — count taps each
  - PASS: All three reachable in ≤2 taps
  - FAIL: Any primary function requires >2 taps

- [ ] **NAV-02** Navigation items do not change position between sessions
  - Method: Note navigation layout, close app, reopen, compare
  - PASS: Navigation items in identical positions
  - FAIL: Any navigation item has moved or been reordered

- [ ] **NAV-03** Back navigation always visible and functional
  - Method: Navigate to any sub-screen, locate back affordance, activate
  - PASS: Back button visible and returns to correct parent screen
  - FAIL: Back button not visible, non-functional, or returns to wrong screen

- [ ] **NAV-04** Current screen location always indicated (title or breadcrumb)
  - Method: Navigate to sub-screens, verify location indicator present
  - PASS: Current location clearly labeled on all screens
  - FAIL: Any screen without location indicator

### 3.2 Home screen

- [ ] **NAV-05 [CRISIS]** Home screen shows maximum 5 data points without scroll
  - Method: Count distinct pieces of information visible above fold on home screen
  - PASS: ≤5 distinct data points
  - FAIL: >5 data points visible above fold

- [ ] **NAV-06** Home screen layout identical regardless of data state
  - Method: Test home screen with: (1) no data, (2) 1 week data, (3) 3 months data
  - PASS: Layout and element positions identical across all three states
  - FAIL: Layout changes based on data state

---

## Section 4: Crisis Mode

- [ ] **CM-01** Crisis mode accessible in ≤1 tap from any screen
  - Method: From each primary screen, locate and activate crisis mode — count taps
  - PASS: ≤1 tap from every primary screen
  - FAIL: >1 tap required, or crisis mode not available on any screen

- [ ] **CM-02 [CRISIS]** Crisis mode shows exactly: runway, balance, one "add expense" button
  - Method: Activate crisis mode, inventory visible elements
  - PASS: Exactly these three elements visible, nothing else
  - FAIL: Additional elements visible, or any of the three missing

- [ ] **CM-03** Crisis mode persists until explicitly exited
  - Method: Activate crisis mode, close and reopen app
  - PASS: Crisis mode still active on reopen
  - FAIL: Crisis mode deactivated by app close/reopen

- [ ] **CM-04 [CRISIS]** Core task completion in crisis mode under simulated cognitive load
  - Method: Use stress scenario SC-01 protocol from stress_scenarios.md
  - PASS: User completes runway check and transaction entry in crisis mode under load
  - FAIL: User cannot complete either task

---

## Section 5: Privacy and Data Control

- [ ] **PD-01** Data export accessible in ≤3 taps from home
  - Method: Navigate to data export from home screen, count taps
  - PASS: ≤3 taps
  - FAIL: >3 taps, or export not available

- [ ] **PD-02** Clear statement of local vs. synced data accessible from settings
  - Method: Locate privacy information in settings
  - PASS: Statement present, describes exactly what is stored locally and what leaves the device
  - FAIL: No statement, or statement is vague/ambiguous

- [ ] **PD-03** Delete all data option accessible with recovery window
  - Method: Locate and exercise delete all data flow
  - PASS: Delete option in settings, confirmation step, recovery window of ≥30 minutes before permanent deletion
  - FAIL: No delete option, immediate permanent deletion, or no confirmation

- [ ] **PD-04** No third-party data sharing
  - Method: Review network requests during normal app use (developer inspection)
  - PASS: Zero data transmitted to third parties (excluding optional explicit user actions)
  - FAIL: Any user financial data transmitted to third parties without explicit per-transaction consent

---

## Section 6: Language Audit

*Complete this audit for the entire app before release. A single failure blocks release.*

- [ ] **LA-01** Zero instances of blame language in entire app
  - Prohibited terms: "you haven't," "you failed," "you missed," "your fault," "you should have"
  - Method: Full text audit of all screens, notifications, emails, and error states
  - PASS: Zero prohibited instances
  - FAIL: Any instance

- [ ] **LA-02** Zero instances of urgency-demand language
  - Prohibited terms: "must," "required," "you need to," "immediately," "urgent," "danger," "critical," "overdue"
  - Method: Full text audit
  - PASS: Zero instances in user-facing text
  - FAIL: Any instance

- [ ] **LA-03** Zero instances of comparative judgment
  - Prohibited patterns: "worse than average," "below typical," "most users," comparisons to benchmarks
  - Method: Full text audit
  - PASS: Zero instances
  - FAIL: Any instance

- [ ] **LA-04** All notifications framed as invitations, not demands
  - Method: Review all notification templates
  - PASS: All notifications use invitation framing ("Your runway is ready to review" not "Update your expenses")
  - FAIL: Any notification uses demand framing

---

## Section 7: Visual Design Audit

- [ ] **VD-01** Maximum 3 colors in primary UI (excluding content-specific states)
  - Method: Visual audit of primary screens
  - PASS: ≤3 distinct colors in UI chrome
  - FAIL: >3 colors

- [ ] **VD-02** No animations on data elements
  - Method: Navigate all screens, note any animations on numbers/text/data
  - PASS: Data elements are static; loading states may animate
  - FAIL: Any data element (balance, runway, transaction amounts) animates

- [ ] **VD-03** Minimum 16px font size for all body text
  - Method: Inspect all text elements in app
  - PASS: All body text ≥16px equivalent
  - FAIL: Any body text <16px

- [ ] **VD-04** Alarm red not used for financial states
  - Method: Trigger all financial states (low runway, low balance, etc.), inspect colors
  - PASS: No state uses alarm red (≤30° from #FF0000 at >50% saturation)
  - FAIL: Alarm red used for any financial state

---

## Release Gates

**MVP release requires ALL of the following to PASS:**
- All TE items (transaction entry)
- All RV items (runway visibility)
- NAV-01, NAV-02, NAV-03 (basic navigation)
- CM-01, CM-02 (crisis mode existence)
- PD-04 (no third-party data sharing)
- LA-01, LA-02 (zero blame/demand language)

**Full release requires ALL items to PASS.**

**[CRISIS] items must additionally pass under stress scenario SC-01 protocol before any release.**
