@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: READY
@@CONFIDENCE: HIGH
@@OPEN_DECISIONS: 0
@@OPEN_ASSUMPTIONS: 2
@@END_HEADER

# Constellation Packet

## 1. Objective
- **Problem**: Users need to quickly calculate tip and total amount when dining out
- **Desired outcome**: Single HTML file that calculates tip amount and total bill from bill amount and tip percentage inputs
- **Success checks**: User enters bill amount and tip percentage, sees correct total displayed instantly

## 2. In scope / Out of scope

**In scope:**
- Bill amount input field
- Tip percentage input field  
- Real-time calculation display
- Basic input validation
- Single HTML file delivery
- Modern browser compatibility

**Out of scope:**
- Multiple tip calculators or advanced features
- Bill splitting functionality
- Tip suggestion features
- External dependencies or frameworks
- Mobile app or PWA features
- IE compatibility
- Server-side processing

## 3. Source-of-truth constraints
- Must be delivered as single HTML file
- Must accept bill amount input
- Must accept tip percentage input
- Must display calculated total
- Must work in modern web browsers without external dependencies

## 4. Architecture and flow
- **Components**: Single HTML page with embedded CSS and JavaScript
- **Data flow**: User input → validation → calculation → display update
- **State transitions**: Empty → Valid inputs → Calculated result
- **External dependencies**: None (all code inline)

## 5. Contracts and invariants
- **Inputs**: 
  - Bill amount (positive number)
  - Tip percentage (non-negative number)
- **Output**: Total amount rounded to 2 decimal places
- **Calculation**: `total = bill + (bill * tipPercent / 100)`
- **Validation**: Non-numeric inputs show error state
- **Display**: Currency formatting with 2 decimal places

## 6. File-by-file implementation plan

**tip-calculator.html** (single file):
- **Purpose**: Complete tip calculator application
- **Structure**:
  - HTML: Form inputs for bill and tip percentage, display area for results
  - CSS: Basic styling and responsive layout (inline in `<style>` tag)
  - JavaScript: Input validation, calculation logic, DOM updates (inline in `<script>` tag)
- **Key functions**:
  - `calculateTip()`: Core calculation logic
  - `updateDisplay()`: Update result display
  - `validateInput()`: Check for valid numeric input
  - Event listeners for real-time updates

## 7. Build order
1. Create HTML structure with input fields and result display
2. Add inline CSS for basic styling and layout
3. Implement JavaScript calculation function
4. Add input validation logic
5. Wire up event listeners for real-time updates
6. Test with example scenarios
7. Add error handling for edge cases

## 8. Acceptance tests
- Enter $50 bill with 20% tip → displays $60.00 total
- Enter $23.45 bill with 18% tip → displays $27.67 total
- Enter non-numeric bill amount → shows validation error
- Enter negative tip percentage → handles gracefully
- Open file in Chrome, Firefox, Safari → works correctly
- Resize browser window → layout remains usable
- Calculate with decimal inputs → rounds to 2 decimal places

## 9. Risks, assumptions, and rollback
**Open assumptions:**
1. Standard currency rounding (2 decimal places) is acceptable
2. Tip percentage input expects whole numbers (18 for 18%, not 0.18)

**Risk hotspots:**
- Floating point precision issues with currency calculations
- Input validation edge cases with very large numbers

**Rollback**: Single file can be easily reverted or modified since all code is in one location

## 10. Escalate instead of guessing
- If specific rounding behavior requirements conflict with standard currency rounding
- If mobile responsiveness requirements exceed basic CSS capabilities
- If browser compatibility issues arise that require polyfills or external libraries
- If validation requirements become more complex than basic numeric checks
- If styling requirements exceed what can be reasonably achieved with inline CSS