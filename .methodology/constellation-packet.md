@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: READY
@@CONFIDENCE: MEDIUM
@@OPEN_DECISIONS: 0
@@OPEN_ASSUMPTIONS: 3
@@END_HEADER

# Constellation Packet

## 1. Objective
- **Problem**: Mirror Mind users need a secure, user-controlled way to share weekly progress summaries with their therapists
- **Desired outcome**: Users can configure privacy settings, manage therapist contacts, preview summaries, and trigger weekly sends with confidence
- **Success checks**: Users can complete the full flow from configuration to sending without confusion, and therapists receive properly formatted summaries

## 2. In scope / Out of scope

**In scope:**
- Privacy controls for data inclusion/exclusion
- Therapist contact management (add/edit/remove)
- Weekly summary preview functionality
- Manual and automatic weekly send triggers
- Send confirmation and status tracking

**Out of scope:**
- Summary generation algorithm (assumes existing capability)
- Therapist-side receiving interface
- Historical send logs beyond basic status
- Multi-language support
- Integration with external EHR systems

## 3. Source-of-truth constraints
- All therapist data sharing requires explicit user consent per session
- Users must be able to exclude any data category from summaries
- Summaries must be previewable before sending
- Send actions must be auditable (who, when, what was included)
- Therapist contact information must be encrypted at rest

## 4. Architecture and flow
**Components:**
- Privacy settings panel
- Therapist contact manager
- Summary preview modal
- Send trigger interface
- Confirmation/status notifications

**Data flow:**
1. User configures privacy settings → stored preferences
2. User adds/manages therapist contacts → encrypted contact storage
3. Weekly trigger (manual/auto) → generate summary with privacy filters
4. User previews filtered summary → approval/edit cycle
5. User confirms send → delivery + audit log

**State transitions:**
- Configuration → Preview → Send → Confirmation
- Rollback possible at any step before final send

## 5. Contracts and invariants

**Privacy Settings Schema:**
```typescript
interface PrivacySettings {
  includeJournalEntries: boolean
  includeMoodData: boolean
  includeGoalProgress: boolean
  includeSessionNotes: boolean
  customExclusions: string[]
}
```

**Therapist Contact Schema:**
```typescript
interface TherapistContact {
  id: string
  name: string
  email: string
  encryptedNotes?: string
  isActive: boolean
  addedDate: Date
}
```

**Summary Preview Schema:**
```typescript
interface SummaryPreview {
  weekRange: DateRange
  includedSections: string[]
  excludedSections: string[]
  contentPreview: string
  estimatedLength: number
}
```

**Invariants:**
- Privacy settings must be applied before any summary generation
- No summary can be sent without user preview approval
- All send actions must generate audit entries

## 6. File-by-file implementation plan

**`components/PrivacySettings.tsx`**
- Purpose: Configure what data categories to include in summaries
- Change: New component
- Key functions: `updatePrivacySettings()`, `validateSettings()`

**`components/TherapistManager.tsx`**
- Purpose: CRUD operations for therapist contacts
- Change: New component
- Key functions: `addTherapist()`, `editTherapist()`, `removeTherapist()`, `validateContact()`

**`components/SummaryPreview.tsx`**
- Purpose: Show filtered summary before sending
- Change: New component
- Key functions: `generatePreview()`, `approveForSend()`, `requestChanges()`

**`components/SendTrigger.tsx`**
- Purpose: Manual send button and auto-send configuration
- Change: New component
- Key functions: `triggerSend()`, `scheduleWeekly()`, `cancelSend()`

**`hooks/useProgressSharing.ts`**
- Purpose: Business logic for the sharing flow
- Change: New hook
- Key functions: `applyPrivacyFilters()`, `sendToTherapist()`, `trackSendStatus()`

**`services/summaryService.ts`**
- Purpose: Integration with existing summary generation
- Change: New service layer
- Key functions: `generateFilteredSummary()`, `deliverSummary()`, `auditSend()`

**`types/sharing.ts`**
- Purpose: TypeScript interfaces for sharing functionality
- Change: New types file
- Key interfaces: All schemas from section 5

## 7. Build order

1. **Foundation**: Create types and service layer (`types/sharing.ts`, `services/summaryService.ts`)
2. **Privacy Settings**: Build and test privacy configuration (`components/PrivacySettings.tsx`)
3. **Contact Management**: Build therapist CRUD (`components/TherapistManager.tsx`)
4. **Business Logic**: Implement sharing hook (`hooks/useProgressSharing.ts`)
5. **Preview System**: Build summary preview (`components/SummaryPreview.tsx`)
6. **Send Triggers**: Implement send mechanisms (`components/SendTrigger.tsx`)
7. **Integration**: Wire components together in main interface
8. **End-to-end testing**: Complete flow testing

## 8. Acceptance tests

- User can toggle privacy settings and see immediate preview updates
- User can add therapist contact with validation
- User can preview weekly summary with correct privacy filters applied
- User can send summary and receive confirmation
- User can set up weekly auto-send and modify schedule
- All send actions create proper audit entries
- Privacy exclusions work correctly (excluded data never appears in previews/sends)
- Contact encryption works (therapist data unreadable in storage inspection)

## 9. Risks, assumptions, and rollback

**Open assumptions:**
1. Existing summary generation service can accept privacy filter parameters
2. Email delivery service exists and is reliable
3. User authentication context is available in sharing components

**Risk hotspots:**
- Privacy filter implementation complexity
- Email delivery reliability
- User consent flow compliance

**Rollback plan:**
- All sharing features can be feature-flagged off
- Privacy settings default to maximum exclusion
- Manual send-only fallback if auto-send fails

## 10. Escalate instead of guessing

- **STOP_AND_ASK** if existing summary generation API doesn't support filtering
- **STOP_AND_ASK** if legal/compliance requirements for therapist data sharing are unclear
- **STOP_AND_ASK** if email delivery service integration requirements are undefined
- **STOP_AND_ASK** if user authentication/authorization patterns are not established