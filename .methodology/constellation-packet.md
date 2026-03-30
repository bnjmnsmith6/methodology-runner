@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: READY
@@CONFIDENCE: HIGH
@@OPEN_DECISIONS: 0
@@OPEN_ASSUMPTIONS: 2
@@END_HEADER

# Constellation Packet

## 1. Objective
- **Problem**: Create an interactive click counter as a single self-contained HTML file
- **Desired outcome**: HTML file that displays a number and increments it when clicked
- **Success checks**: File loads in browser, number is prominently displayed, clicking increases count

## 2. In scope / Out of scope

**In scope:**
- Single HTML file with embedded CSS and JavaScript
- Click event handling to increment counter
- Prominent visual display of the current count
- Session persistence (counter persists while page is open)

**Out of scope:**
- Cross-session persistence (localStorage, cookies, etc.)
- Multiple counters or complex UI
- External stylesheets, scripts, or frameworks
- Keyboard or touch gesture alternatives to clicking
- Animation or transition effects

## 3. Source-of-truth constraints
- Must be exactly one HTML file with no external dependencies
- Must load and function in modern browsers without internet connection
- Counter must start at 0
- Each click must increment by exactly 1
- Number display must be visually prominent

## 4. Architecture and flow
- **Components**: Single HTML page with inline CSS and JavaScript
- **Data flow**: Click event → increment counter variable → update DOM display
- **State transitions**: counter (integer) increments from 0 upward
- **External dependencies**: None (browser JavaScript engine only)

## 5. Contracts and invariants
- **Input**: Mouse click events on the counter display element
- **Output**: Updated counter value in the DOM
- **Data structure**: Single integer variable tracking count
- **Invariant**: Counter value always ≥ 0 and increases monotonically

## 6. File-by-file implementation plan

**counter.html** (single file):
- **Purpose**: Complete click counter application
- **Change required**: Create new file
- **Key components**:
  - HTML structure with clickable counter display element
  - CSS for prominent styling (large font, centered layout)
  - JavaScript event listener for click handling
  - JavaScript function to increment counter and update display

## 7. Build order
1. Create HTML structure with counter display element
2. Add CSS styling for prominent display
3. Add JavaScript counter variable initialization
4. Implement click event listener and increment function
5. Test in browser

## 8. Acceptance tests
- [ ] File opens in browser without errors
- [ ] Counter displays "0" prominently on initial load
- [ ] Single click changes display to "1"
- [ ] Multiple rapid clicks increment correctly (e.g., 10 clicks → "10")
- [ ] Counter persists during page session (no reset on window resize, etc.)
- [ ] File works offline (no network requests)

## 9. Risks, assumptions, and rollback

**Open assumptions:**
1. "Prominent display" = large font size, centered on page
2. Modern browser support (ES5+ JavaScript, basic CSS)

**Risk hotspots:**
- Rapid clicking causing display lag (low risk for simple increment)
- Browser compatibility issues with event handling (low risk)

**Rollback**: If technical issues arise, escalate rather than adding complexity

## 10. Escalate instead of guessing
- If "prominent display" requirements are unclear after basic large/centered styling
- If browser compatibility issues emerge during testing
- If counter behavior edge cases arise (negative numbers, overflow, etc.)
- If single-file constraint conflicts with any functional requirement