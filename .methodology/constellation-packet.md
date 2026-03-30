@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: READY
@@CONFIDENCE: MEDIUM
@@OPEN_DECISIONS: 0
@@OPEN_ASSUMPTIONS: 3
@@END_HEADER

# Constellation Packet

## 1. Objective
- **Problem**: AI assistant output is difficult to read and interact with on mobile devices due to poor responsive design
- **Desired outcome**: Mobile-first viewer interface that renders AI output clearly across phone screen sizes with intuitive navigation
- **Success checks**: Output displays legibly on 375px-414px viewports, touch interactions work smoothly, page loads under 3 seconds on 3G

## 2. In scope / Out of scope

**In scope:**
- Mobile-responsive HTML/CSS/JS viewer interface
- Content rendering for text, code blocks, structured data (JSON, tables)
- Touch-friendly navigation patterns
- Performance optimization for mobile networks
- Support for common mobile browsers (Chrome, Safari, Firefox mobile)

**Out of scope:**
- Desktop optimization (mobile-first approach)
- Real-time streaming of AI output
- Authentication/user management
- AI model integration or backend services
- Offline functionality
- Push notifications
- Native mobile app development

## 3. Source-of-truth constraints
- Must work on viewport widths 320px-414px
- Must load initial content within 3 seconds on simulated 3G
- Must support iOS Safari 14+ and Android Chrome 90+
- Touch targets must be minimum 44px for accessibility
- Content must be readable without horizontal scrolling

## 4. Architecture and flow
- **Components**: Header navigation, content renderer, mobile menu overlay
- **Data flow**: Static HTML → CSS responsive layout → JS progressive enhancement → content rendering
- **State transitions**: Loading → Content display → Menu open/close → Content type switching
- **External dependencies**: None (self-contained static assets)

## 5. Contracts and invariants
- **Input format**: HTML structure with data attributes for content type identification
- **Content types**: `text`, `code`, `json`, `table`, `list`
- **Viewport breakpoints**: 320px, 375px, 414px
- **Performance budget**: <100KB initial bundle, <2MB total assets
- **Touch interaction zones**: Minimum 44px tap targets with 8px spacing

## 6. File-by-file implementation plan

**index.html**
- Purpose: Main viewer container and content structure
- Change required: Create responsive HTML shell with semantic content areas
- Key elements: `<main class="viewer">`, content type containers, navigation elements

**styles/mobile.css**
- Purpose: Mobile-first responsive styles
- Change required: Create from scratch with CSS Grid/Flexbox layout
- Key features: Typography scale, touch-friendly controls, content type styling

**scripts/viewer.js**
- Purpose: Progressive enhancement for interactions
- Change required: Create vanilla JS for menu toggle, content type switching
- Key functions: `toggleMenu()`, `renderContent(type)`, `handleTouchNavigation()`

**styles/content-types.css**
- Purpose: Specialized styling for different AI output formats
- Change required: Create responsive code blocks, tables, JSON viewers
- Key components: `.code-block`, `.json-viewer`, `.data-table`

## 7. Build order
1. Create HTML structure with semantic markup and content placeholders
2. Implement mobile-first CSS with responsive typography and layout
3. Add content-type specific styling (code, tables, JSON)
4. Implement JavaScript for progressive enhancement
5. Performance optimization (minification, compression)
6. Cross-browser testing on target devices

## 8. Acceptance tests
- [ ] Page renders correctly on iPhone SE (375x667) and Pixel 4 (393x851)
- [ ] Code blocks have horizontal scroll with syntax highlighting
- [ ] Tables are horizontally scrollable with fixed headers
- [ ] JSON structures collapse/expand on touch
- [ ] Menu opens/closes with smooth animation
- [ ] Page loads under 3 seconds on Chrome DevTools 3G throttling
- [ ] All touch targets meet 44px minimum size
- [ ] Content readable without pinch-to-zoom

## 9. Risks, assumptions, and rollback
**Open assumptions:**
1. AI output will be provided as pre-formatted HTML with data attributes
2. Content length will be reasonable for mobile viewing (not massive datasets)
3. No need for persistent state between sessions

**Risk hotspots:**
- Complex table rendering on narrow screens may require custom horizontal scroll
- Code syntax highlighting library size could impact performance budget
- iOS Safari viewport height behavior with address bar

**Rollback plan:**
- Keep unstyled HTML functional as baseline
- Progressive enhancement allows graceful degradation

## 10. Escalate instead of guessing
- If AI output format specification is unclear or changes during development
- If performance budget cannot be met with required features
- If accessibility requirements beyond basic touch targets are discovered
- If specific mobile browser compatibility issues arise that require significant workarounds