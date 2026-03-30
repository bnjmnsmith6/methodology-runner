@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: READY
@@CONFIDENCE: HIGH
@@OPEN_DECISIONS: 0
@@OPEN_ASSUMPTIONS: 2
@@END_HEADER

# Constellation Packet

## 1. Objective
- **Problem:** Need a self-contained dice rolling tool that works in any browser
- **Desired outcome:** Single HTML file that displays animated dice, rolls 1-6 on click
- **Success checks:** File opens in browser, click triggers animation, random 1-6 result displays

## 2. In scope / Out of scope

**In scope:**
- Single HTML file with embedded CSS/JavaScript
- Click-triggered dice roll animation
- Random number generation (1-6)
- Visual dice representation
- Animation feedback during roll

**Out of scope:**
- Multiple dice
- Custom number ranges
- External CSS/JS files
- Server-side functionality
- Advanced accessibility features
- Mobile-specific optimizations beyond standard web behavior

## 3. Source-of-truth constraints
- Must be a single HTML file
- No external dependencies (no CDNs, external CSS/JS, images)
- Must work when opened directly in browser (file:// protocol)
- Must generate random numbers 1-6
- Must include visible animation on dice roll

## 4. Architecture and flow
**Components:**
- HTML structure: dice container, result display
- CSS: dice styling, animation keyframes, layout
- JavaScript: click handler, random generation, animation trigger

**Data flow:**
1. User clicks dice element
2. JavaScript generates random 1-6
3. Animation plays (rolling effect)
4. Result displays after animation completes

**State transitions:**
- Idle → Rolling (on click) → Display Result → Idle

## 5. Contracts and invariants
**Input:** Mouse click on dice element
**Output:** Random integer 1-6 displayed visually
**Invariants:**
- Random number must be 1-6 inclusive
- Animation must complete before showing result
- File must be self-contained (no external requests)
- Must function without internet connection

## 6. File-by-file implementation plan

**index.html (single file):**
- **Purpose:** Complete dice roller application
- **Change required:** Create from scratch
- **Key components:**
  - `<div>` for dice container with click handler
  - `<div>` for result display
  - `<style>` block with CSS animations and dice styling
  - `<script>` block with click handler and random logic
  - CSS keyframes for rolling animation
  - JavaScript `Math.random()` for 1-6 generation

## 7. Build order
1. Create basic HTML structure (dice container, result display)
2. Add CSS styling for dice appearance and layout
3. Implement CSS animation keyframes for rolling effect
4. Add JavaScript click handler
5. Implement random number generation (1-6)
6. Connect animation trigger to click handler
7. Test animation timing and result display
8. Validate cross-browser functionality

## 8. Acceptance tests
1. **File independence:** Open file directly in browser without server
2. **Click response:** Click dice, animation triggers immediately
3. **Random generation:** Multiple clicks produce different results across 1-6 range
4. **Animation completion:** Result displays only after animation finishes
5. **Visual clarity:** Dice and numbers are clearly visible
6. **No external requests:** Network tab shows no outbound requests

## 9. Risks, assumptions, and rollback
**Open assumptions:**
1. CSS transitions will provide adequate animation smoothness on target browsers
2. Standard click events will work for both mouse and touch interactions

**Risk hotspots:**
- Animation performance on older browsers → Fallback: shorter/simpler animation
- JavaScript execution failure → Fallback: basic click handler without animation

**Rollback:** If animation proves problematic, simplify to instant result display with basic visual feedback

## 10. Escalate instead of guessing
- If CSS animations don't render smoothly across browsers, escalate for animation approach decision
- If single-file constraint conflicts with animation requirements, escalate for constraint modification
- If random number generation fails in any browser, escalate for technical approach revision
- If file size becomes excessive due to inline assets, escalate for constraint clarification