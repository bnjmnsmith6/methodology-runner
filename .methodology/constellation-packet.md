@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: READY
@@CONFIDENCE: HIGH
@@OPEN_DECISIONS: 0
@@OPEN_ASSUMPTIONS: 1
@@END_HEADER

# Constellation Packet

## 1. Objective
- **Problem**: Users need easy access to motivational quotes without internet dependency or complex software
- **Desired outcome**: Self-contained HTML file that displays random motivational quotes with user control
- **Success checks**: File opens in any modern browser, displays quote on load, refresh button generates new quotes, works offline

## 2. In scope / Out of scope
**In scope:**
- Single HTML file with 30-50 embedded quotes
- Auto-display random quote on page load
- Refresh button for new quotes
- Basic styling for readability
- No external dependencies

**Out of scope:**
- Quote categorization or filtering
- User preferences or persistence
- Social sharing features
- Quote attribution beyond author names
- Mobile-specific responsive design (basic CSS only)
- Backend integration or dynamic quote fetching

## 3. Source-of-truth constraints
- Must be exactly one HTML file
- No external HTTP requests, CDNs, or file dependencies
- Must work in modern browsers without internet connection
- All assets (CSS, JavaScript, content) embedded inline

## 4. Architecture and flow
- **Components**: HTML structure, CSS styling (inline), JavaScript quote engine, quote data array
- **Data flow**: Page load → random quote selection → DOM update → user clicks refresh → new random selection
- **State transitions**: Initial load → Quote displayed → User interaction → New quote displayed
- **External dependencies**: None (browser JavaScript engine only)

## 5. Contracts and invariants
- **Quote data structure**: `{text: string, author: string}` objects in JavaScript array
- **Random selection**: Must avoid showing same quote twice in immediate succession
- **DOM update interface**: Quote text and author fields must update atomically
- **File size constraint**: Keep under 100KB for reasonable loading
- **Browser compatibility**: Standard ES5+ JavaScript, no modern framework dependencies

## 6. File-by-file implementation plan
**motivational-quotes.html** (single file):
- **Purpose**: Complete self-contained motivational quote generator
- **HTML structure**: Title, quote display area, author display area, refresh button
- **CSS section**: Inline styles for centering, typography, button styling
- **JavaScript section**: Quote array (30-50 quotes), random selection function, DOM manipulation, button event handler
- **Key functions**: 
  - `getRandomQuote()`: Returns random quote object, avoids immediate duplicates
  - `displayQuote(quote)`: Updates DOM with quote text and author
  - `refreshQuote()`: Button click handler

## 7. Build order
1. Create HTML skeleton with basic structure
2. Add inline CSS for visual presentation
3. Create JavaScript quote data array (30-50 motivational quotes)
4. Implement random quote selection logic with duplicate avoidance
5. Add DOM manipulation functions
6. Wire up button event handler
7. Add page load initialization
8. Test in multiple browsers and validate offline functionality

## 8. Acceptance tests
- [ ] File opens successfully in Chrome, Firefox, Safari, Edge
- [ ] Random quote displays automatically on page load
- [ ] Refresh button generates different quote (test 10+ clicks)
- [ ] No duplicate quotes appear in immediate succession
- [ ] File works without internet connection
- [ ] File size under 100KB
- [ ] No console errors in browser developer tools
- [ ] Quote text and author both display properly formatted

## 9. Risks, assumptions, and rollback
**Open assumptions:**
1. Generic motivational quotes are appropriate (no content curation process defined)

**Risk hotspots:**
- Quote content appropriateness (no validation process)
- Browser compatibility edge cases
- JavaScript disabled scenarios

**Rollback plan**: If issues arise, fall back to static display of single quote without randomization functionality

## 10. Escalate instead of guessing
**STOP_AND_ASK conditions:**
- Need guidance on quote content selection criteria or review process
- File size exceeds 100KB and compression strategies needed
- Cross-browser compatibility issues that require polyfills
- User requests additional features beyond scope (categorization, persistence, etc.)
- Performance issues with large quote arrays in older browsers