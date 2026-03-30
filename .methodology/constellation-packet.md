@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: READY
@@CONFIDENCE: HIGH
@@OPEN_DECISIONS: 0
@@OPEN_ASSUMPTIONS: 3
@@END_HEADER

# Constellation Packet

## 1. Objective
- **Problem**: Users need a simple, interactive coin flip simulator accessible from any modern browser
- **Desired outcome**: Single HTML file that simulates coin flips with visual animation and result tracking
- **Success checks**: Click interaction triggers flip animation, displays heads/tails result, maintains persistent tally counter

## 2. In scope / Out of scope

**In scope:**
- Single HTML file with embedded CSS and JavaScript
- Click-triggered coin flip animation
- Heads/tails result display
- Running tally counter (heads count, tails count, total flips)
- Basic CSS animation for flip effect
- Modern browser compatibility (Chrome, Firefox, Safari, Edge current versions)

**Out of scope:**
- Multi-file architecture
- Complex 3D animations or WebGL effects
- Data persistence across browser sessions
- Mobile app packaging
- Advanced accessibility features beyond standard HTML
- Backend services or APIs

## 3. Source-of-truth constraints
- Must be deliverable as single HTML file
- Must work without external dependencies (no CDN resources)
- Must include click interaction to trigger flips
- Must display flip animation
- Must show heads/tails result after each flip
- Must maintain running tally of results

## 4. Architecture and flow
**Components:**
- HTML structure: coin display area, result display, tally counters
- CSS: coin styling, flip animation keyframes, layout
- JavaScript: click handlers, random result generation, animation control, counter updates

**Data flow:**
1. User clicks coin element
2. JavaScript generates random heads/tails result
3. CSS animation plays (coin flip effect)
4. Result displays after animation completes
5. Tally counters increment
6. System ready for next click

**State transitions:**
- Idle → Animation → Result Display → Idle

## 5. Contracts and invariants
**Input/Output:**
- Input: Mouse click on coin element
- Output: Visual flip animation + heads/tails result + updated tallies

**Core invariants:**
- Each flip must have exactly one result (heads OR tails)
- Tally counts must increment by exactly 1 per flip
- Total flips = heads count + tails count
- Animation must complete before next flip can begin

**Data structures:**
```javascript
{
  headsCount: number,
  tailsCount: number,
  isAnimating: boolean,
  currentResult: 'heads' | 'tails' | null
}
```

## 6. File-by-file implementation plan

**index.html (single file):**
- **Purpose**: Complete coin flip simulator application
- **HTML structure**: 
  - Coin display div with click handler
  - Result display area
  - Tally counter display (heads/tails/total)
- **CSS section**:
  - Coin styling (circular, coin-like appearance)
  - Flip animation keyframes (rotateY transform)
  - Layout and typography
- **JavaScript section**:
  - `flipCoin()` function (main click handler)
  - `generateResult()` function (random heads/tails)
  - `updateDisplay()` function (show result and update counters)
  - `animateCoin()` function (trigger CSS animation)

## 7. Build order
1. Create basic HTML structure with coin element and display areas
2. Implement CSS styling for coin appearance and layout
3. Create CSS flip animation keyframes
4. Implement JavaScript random result generation
5. Add click event handling and animation triggering
6. Implement tally counter logic and display updates
7. Test flip sequence and counter accuracy
8. Polish styling and timing

## 8. Acceptance tests
1. **Click response**: Clicking coin element triggers immediate animation
2. **Animation completion**: Flip animation plays fully before showing result
3. **Result accuracy**: Each flip shows either "Heads" or "Tails" (never both, never neither)
4. **Counter accuracy**: Tallies increment correctly (heads+tails=total)
5. **Multiple flips**: Can perform consecutive flips without errors
6. **Visual feedback**: Clear distinction between heads and tails results
7. **Browser compatibility**: Functions correctly in Chrome, Firefox, Safari, Edge

## 9. Risks, assumptions, and rollback

**Open assumptions:**
1. Animation duration of ~1 second is acceptable (not specified in requirements)
2. Basic coin visual (circular div with text/styling) is sufficient (no actual coin image provided)
3. Simple CSS transforms provide adequate flip effect (vs. complex 3D animations)

**Risk hotspots:**
- CSS animation performance on older devices
- Animation timing conflicts if user clicks rapidly

**Rollback approach:**
- If animation performance issues arise: remove animation, keep instant result display
- If random generation seems biased: verify Math.random() implementation

## 10. Escalate instead of guessing

**STOP_AND_ASK conditions:**
- If specific coin image assets or visual design requirements emerge
- If browser compatibility requirements extend to legacy versions (IE, old mobile browsers)
- If animation performance is unacceptable and fallback approaches are insufficient
- If accessibility requirements beyond standard HTML practices are needed
- If data persistence across sessions becomes required