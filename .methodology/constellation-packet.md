@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: READY
@@CONFIDENCE: HIGH
@@OPEN_DECISIONS: 0
@@OPEN_ASSUMPTIONS: 2
@@END_HEADER

# Constellation Packet

## 1. Objective
- **Problem**: Need a countdown timer to New Year's 2027 that is self-contained and visually prominent
- **Desired outcome**: Single HTML file that displays a real-time countdown with large, visible numbers on a dark background
- **Success checks**: 
  - Timer shows days:hours:minutes:seconds until Jan 1, 2027 00:00:00 local time
  - Numbers are large and clearly readable
  - Dark theme is applied
  - Updates every second without page refresh

## 2. In scope / Out of scope

**In scope:**
- Single HTML file with embedded CSS and JavaScript
- Real-time countdown display (days, hours, minutes, seconds)
- Dark theme styling
- Large, clearly visible numbers
- Client-side calculation using user's local timezone

**Out of scope:**
- Multiple timezone support
- Sound alerts or notifications
- User customization options
- Responsive design for mobile
- What happens after countdown reaches zero
- External dependencies or libraries

## 3. Source-of-truth constraints
- Must be single HTML file with no external dependencies
- Client-side only (no server communication)
- Target date: January 1, 2027 00:00:00 local timezone
- Must use modern browser features (last 2 years compatibility)
- Dark theme required
- Large numbers required for visibility

## 4. Architecture and flow
- **Components**: Single HTML file containing HTML structure, CSS styles, and JavaScript logic
- **Data flow**: JavaScript calculates time difference → Updates DOM elements → Repeats every second
- **State transitions**: Page load → Calculate initial countdown → Start interval timer → Update display continuously
- **External dependencies**: None (browser Date API only)

## 5. Contracts and invariants
- **Input**: Current system time via `Date.now()`
- **Output**: Visual countdown display updated every second
- **Time format**: "X days Y hours Z minutes W seconds" or similar clear format
- **Update frequency**: Exactly 1000ms intervals via `setInterval`
- **Target timestamp**: `new Date('2027-01-01T00:00:00')` in local timezone
- **Non-negotiable rules**: 
  - No external file dependencies
  - Must handle negative time gracefully (countdown complete)
  - Timer must start immediately on page load

## 6. File-by-file implementation plan

**countdown.html** (single file):
- **Purpose**: Complete countdown timer application
- **HTML section**: Basic structure with containers for each time unit (days, hours, minutes, seconds)
- **CSS section**: Dark theme styling, large font sizing for numbers, layout for time display
- **JavaScript section**: 
  - Calculate time difference function
  - DOM update function  
  - `setInterval` setup for continuous updates
  - Page load initialization

**Key functions required:**
- `calculateTimeRemaining()` - returns object with days, hours, minutes, seconds
- `updateDisplay()` - updates DOM with current countdown values
- `formatTimeUnit(value)` - ensures two-digit display for consistency
- Event listener for `DOMContentLoaded` to start timer

## 7. Build order
1. Create HTML structure with semantic containers for time units
2. Implement CSS for dark theme and large number styling
3. Write JavaScript time calculation logic
4. Implement DOM update functions
5. Set up `setInterval` timer and page load initialization
6. Test countdown accuracy and visual appearance
7. Handle edge case where countdown reaches zero

## 8. Acceptance tests
- **Visual test**: Open file in browser, verify dark background with large, bright numbers
- **Accuracy test**: Compare countdown to system clock, verify second-by-second updates
- **Format test**: Verify display shows "X days Y hours Z minutes W seconds" format
- **Self-contained test**: Verify file works offline with no network requests
- **Browser test**: Verify works in Chrome/Firefox/Safari from last 2 years
- **Target date test**: Manually verify target is January 1, 2027 00:00:00 local time

## 9. Risks, assumptions, and rollback
**Open assumptions:**
1. "Large numbers" interpreted as significantly larger than default browser text (assume 48px+ font size)
2. Dark theme interpreted as dark background with light text (assume #000000 or similar background)

**Risk hotspots:**
- Browser timezone handling differences
- Performance impact of `setInterval` on older devices (mitigated by 2-year browser requirement)
- Visual interpretation of "large" and "clearly visible"

**Rollback**: If implementation doesn't meet visual expectations, iterate on CSS styling only - core logic should remain stable.

## 10. Escalate instead of guessing
- **STOP_AND_ASK if**: Visual appearance (font size, colors) is rejected as not "large enough" or not "dark theme" enough
- **STOP_AND_ASK if**: Countdown shows wrong target date or timezone behavior is unexpected
- **STOP_AND_ASK if**: Performance issues occur during testing (timer lagging, browser freezing)
- **STOP_AND_ASK if**: Browser compatibility issues arise with the 2-year compatibility assumption