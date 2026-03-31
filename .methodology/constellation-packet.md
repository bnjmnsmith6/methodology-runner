@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: READY
@@CONFIDENCE: HIGH
@@OPEN_DECISIONS: 0
@@OPEN_ASSUMPTIONS: 1
@@END_HEADER

# Constellation Packet

## 1. Objective
- **Problem**: Need a simple random number generator tool accessible in any browser
- **Desired outcome**: Single HTML file that generates random numbers 1-100 on button click
- **Success checks**: File opens in browser, button generates numbers in correct range, no external dependencies required

## 2. In scope / Out of scope

**In scope:**
- Single HTML file with embedded CSS/JavaScript
- Button to trigger random generation
- Display area for generated number
- Random number generation between 1-100 inclusive
- Basic styling for usability

**Out of scope:**
- Multiple number ranges or configuration
- External stylesheets or scripts
- Server-side components
- Number history or statistics
- Advanced UI features beyond basic button/display

## 3. Source-of-truth constraints
- Must be a single HTML file
- No external dependencies (no CDN links, external files)
- Must generate numbers 1-100 inclusive
- Must work when opened directly in browser

## 4. Architecture and flow
- **Components**: HTML structure, embedded CSS, embedded JavaScript, button element, display element
- **Data flow**: Button click → JavaScript event → Math.random() calculation → DOM update
- **State transitions**: Initial state (no number) → Generated state (number displayed) → New generation (number updates)
- **External dependencies**: None (browser JavaScript engine only)

## 5. Contracts and invariants
- **Input**: User button click (no parameters)
- **Output**: Integer between 1 and 100 inclusive
- **DOM structure**: Button with click handler, display element for number output
- **Math constraint**: `Math.floor(Math.random() * 100) + 1` must always produce 1-100 range
- **Display invariant**: Generated number must be visible and clearly presented

## 6. File-by-file implementation plan

**index.html** (single file):
- **Purpose**: Complete random number generator application
- **Change required**: Create new file from scratch
- **Key components**:
  - HTML5 doctype and structure
  - `<button>` element with onclick handler
  - `<div>` or `<span>` for number display
  - `<style>` block with embedded CSS for basic styling
  - `<script>` block with generateNumber() function
  - generateNumber() function using Math.random() formula

## 7. Build order
1. Create HTML5 document structure with DOCTYPE
2. Add button element and display element to body
3. Implement generateNumber() JavaScript function with correct Math.random() formula
4. Wire button onclick to generateNumber function
5. Add basic CSS styling for readability
6. Test in browser: file opens, button works, numbers in range

## 8. Acceptance tests
1. **File opening**: Double-click HTML file opens in default browser without errors
2. **Button functionality**: Clicking button displays a number
3. **Range validation**: Click button 20+ times, verify all numbers are 1-100 inclusive
4. **Display clarity**: Generated number is clearly visible and readable
5. **No dependencies**: File works offline without internet connection
6. **Cross-browser**: Test in at least Chrome/Firefox (standard browser support)

## 9. Risks, assumptions, and rollback

**Open assumptions:**
- Browser has JavaScript enabled (standard assumption for web development)

**Risk hotspots:**
- Math.random() range calculation - off-by-one errors could generate 0 or 101
- Event handling - onclick might not work in all browser security contexts

**Rollback plan:**
- If Math.random() approach fails, the requirement is impossible to meet with current constraints
- If JavaScript is disabled, tool becomes non-functional but this is acceptable per assumptions

## 10. Escalate instead of guessing
- **STOP_AND_ASK if**: Math.random() formula produces numbers outside 1-100 range during testing
- **STOP_AND_ASK if**: Single HTML file constraint conflicts with browser security policies
- **STOP_AND_ASK if**: Basic button/display interface doesn't meet unstated usability expectations
- **Proceed with reasonable defaults for**: Styling choices, button text, display formatting, HTML structure details