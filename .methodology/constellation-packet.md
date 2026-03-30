@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: READY
@@CONFIDENCE: HIGH
@@OPEN_DECISIONS: 0
@@OPEN_ASSUMPTIONS: 2
@@END_HEADER

# Constellation Packet

## 1. Objective
- **Problem**: Create a self-contained HTML stopwatch with start/stop/reset functionality
- **Desired outcome**: Single HTML file that runs a functional stopwatch in any modern browser
- **Success checks**: Timer displays readable format, buttons control timing state, no external dependencies

## 2. In scope / Out of scope

**In scope:**
- Single HTML file with embedded CSS/JavaScript
- Start, stop, reset buttons
- Time display in MM:SS format
- Basic functional styling

**Out of scope:**
- Lap timing functionality
- Save/load state persistence
- Advanced themes or customization
- Mobile-specific optimizations
- Keyboard shortcuts

## 3. Source-of-truth constraints
- Must be single HTML file only
- No external dependencies (libraries, CDNs, separate files)
- Must run in modern browsers (Chrome, Firefox, Safari, Edge)
- Timer must display in readable format
- All three buttons (start/stop/reset) must be functional

## 4. Architecture and flow
- **Components**: HTML structure, CSS styling (inline), JavaScript timing logic
- **Data flow**: User clicks → Button handler → Timer state change → Display update
- **State transitions**: STOPPED → RUNNING → PAUSED → STOPPED (via reset)
- **External dependencies**: None (browser APIs only)

## 5. Contracts and invariants
- **Timer state**: One of `stopped`, `running`, `paused`
- **Display format**: MM:SS (e.g., "01:23" for 1 minute 23 seconds)
- **Timing accuracy**: Use `Date` objects to avoid drift from `setInterval` delays
- **Button states**: Start/Stop toggle based on current timer state, Reset always available

## 6. File-by-file implementation plan

**stopwatch.html** (single file):
- **Purpose**: Complete stopwatch application
- **HTML structure**: 
  - Display div for timer (MM:SS format)
  - Three buttons: Start/Stop, Reset
- **CSS styling** (inline `<style>` tag):
  - Basic button styling
  - Timer display formatting
  - Simple layout (centered)
- **JavaScript logic** (inline `<script>` tag):
  - Timer state management
  - `setInterval` for display updates
  - `Date` object tracking for accuracy
  - Button click handlers

## 7. Build order
1. Create HTML structure with placeholder timer display and buttons
2. Add basic CSS styling for layout and readability
3. Implement JavaScript timer state variables and helper functions
4. Add start/stop button functionality with state toggling
5. Add reset button functionality
6. Implement display update logic with MM:SS formatting
7. Test all three button combinations and edge cases

## 8. Acceptance tests
- [ ] File opens in browser without errors
- [ ] Timer displays "00:00" on load
- [ ] Start button begins counting up (00:01, 00:02, etc.)
- [ ] Stop button pauses timer at current value
- [ ] Start button resumes from paused value
- [ ] Reset button returns timer to "00:00" regardless of state
- [ ] Timer continues accurately for at least 5 minutes without visible drift
- [ ] All functionality works in Chrome, Firefox, Safari, Edge

## 9. Risks, assumptions, and rollback
**Open assumptions:**
1. MM:SS display format is sufficient (not HH:MM:SS for longer sessions)
2. 1-second precision is adequate (not milliseconds)

**Risk hotspots:**
- Timing drift in long sessions (mitigated by `Date` object approach)
- Browser compatibility edge cases (testing strategy covers major browsers)

**Rollback**: Since this is a single file with no external dependencies, rollback is simply reverting to previous file version or starting fresh.

## 10. Escalate instead of guessing
- If timer accuracy requirements need sub-second precision → STOP_AND_ASK
- If display format needs to handle hours (HH:MM:SS) → STOP_AND_ASK  
- If mobile responsiveness becomes a hard requirement → STOP_AND_ASK
- If accessibility compliance beyond basic HTML semantics is required → STOP_AND_ASK
- If any external dependencies are suggested to solve technical issues → STOP_AND_ASK