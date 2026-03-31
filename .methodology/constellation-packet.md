@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: READY
@@CONFIDENCE: HIGH
@@OPEN_DECISIONS: 0
@@OPEN_ASSUMPTIONS: 2
@@END_HEADER

# Constellation Packet

## 1. Objective
- **Problem**: Users need a simple, offline tip calculator that works in any browser
- **Desired outcome**: Single HTML file containing a functional tip calculator with bill amount input, tip percentage input, and total display
- **Success checks**: Opens in browser, accepts numeric inputs, calculates correctly, works offline

## 2. In scope / Out of scope

**In scope:**
- Single HTML file with embedded CSS and JavaScript
- Bill amount input field (numeric)
- Tip percentage input field (numeric)
- Total amount display
- Basic input validation
- Minimal styling for usability

**Out of scope:**
- Multiple file architecture
- Internet connectivity requirements
- Complex UI frameworks
- Advanced features (split bills, multiple tip options, etc.)
- Mobile-specific optimizations
- Accessibility beyond basic semantic HTML

## 3. Source-of-truth constraints
- Must be a single HTML file
- Must work in browser without internet connection
- Must accept numeric inputs for bill amount and tip percentage
- Must display calculated total
- Must handle example: $50 bill + 20% tip = $60 total
- Must handle example: $23.45 bill + 18% tip = correct calculation

## 4. Architecture and flow
- **Components**: Single HTML document with inline CSS and JavaScript
- **Data flow**: User input → JavaScript calculation → DOM update for display
- **Control flow**: Input events trigger real-time calculation and display update
- **External dependencies**: None (fully self-contained)

## 5. Contracts and invariants
- **Inputs**: 
  - Bill amount: numeric value (float/integer)
  - Tip percentage: numeric value (0-100 range assumed)
- **Output**: Total amount (bill + tip) displayed as currency
- **Calculation rule**: total = bill_amount * (1 + tip_percentage/100)
- **Input validation**: Non-numeric inputs should not crash calculator
- **Display format**: Show result as monetary value with 2 decimal places

## 6. File-by-file implementation plan

**tip-calculator.html**
- **Purpose**: Complete tip calculator application
- **Change required**: Create new file
- **Key components**:
  - HTML structure with form inputs and result display
  - CSS styling (inline `<style>` tag) for basic layout and usability
  - JavaScript (inline `<script>` tag) for calculation logic and event handling
  - Input elements: bill amount field, tip percentage field
  - Output element: total display area
  - Event listeners for real-time calculation

## 7. Build order
1. Create basic HTML structure with input fields and display area
2. Add inline CSS for minimal styling and layout
3. Implement JavaScript calculation function
4. Add event listeners for real-time updates
5. Test with acceptance criteria examples
6. Validate single-file constraint and offline functionality

## 8. Acceptance tests
1. **File test**: Single HTML file opens in browser
2. **Input test**: Bill amount field accepts "50", tip percentage accepts "20"
3. **Calculation test**: Above inputs show "$60.00" total
4. **Decimal test**: Bill "23.45" with tip "18" shows "$27.67" total
5. **Real-time test**: Changing inputs immediately updates total
6. **Offline test**: File works when disconnected from internet
7. **Validation test**: Non-numeric input doesn't crash calculator

## 9. Risks, assumptions, and rollback
- **Assumption 1**: Standard HTML input type="number" provides adequate input validation
- **Assumption 2**: JavaScript floating-point precision is acceptable for typical tip amounts
- **Risk**: Very large numbers or edge cases might cause precision issues
- **Rollback**: If precision becomes critical, add explicit rounding logic

## 10. Escalate instead of guessing
- **STOP_AND_ASK if**: Specific currency formatting requirements emerge (beyond 2 decimal places)
- **STOP_AND_ASK if**: Input validation needs become more complex than basic numeric checking
- **STOP_AND_ASK if**: Styling requirements exceed "minimal" (specific design system, branding, etc.)
- **STOP_AND_ASK if**: Browser compatibility issues arise with basic HTML/CSS/JS features