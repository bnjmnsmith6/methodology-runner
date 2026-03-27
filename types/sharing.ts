// Types for the Mirror Mind weekly progress sharing feature

export interface DateRange {
  start: Date
  end: Date
}

export interface PrivacySettings {
  includeJournalEntries: boolean
  includeMoodData: boolean
  includeGoalProgress: boolean
  includeSessionNotes: boolean
  customExclusions: string[]
}

export interface TherapistContact {
  id: string
  name: string
  email: string
  encryptedNotes?: string
  isActive: boolean
  addedDate: Date
}

export interface SummaryPreview {
  weekRange: DateRange
  includedSections: string[]
  excludedSections: string[]
  contentPreview: string
  estimatedLength: number
}

export interface AuditEntry {
  id: string
  userId: string
  therapistId: string
  sentAt: Date
  includedSections: string[]
  weekRange: DateRange
  deliveryStatus: 'pending' | 'delivered' | 'failed'
}

export interface AutoSendSchedule {
  enabled: boolean
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6  // 0 = Sunday
  hour: number                              // 0–23
  therapistIds: string[]
}

export interface SendStatus {
  inFlight: boolean
  lastSentAt: Date | null
  lastStatus: 'idle' | 'pending' | 'delivered' | 'failed'
  errorMessage?: string
}

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  includeJournalEntries: false,
  includeMoodData: false,
  includeGoalProgress: false,
  includeSessionNotes: false,
  customExclusions: [],
}

export const ALL_DATA_SECTIONS = [
  'journalEntries',
  'moodData',
  'goalProgress',
  'sessionNotes',
] as const

export type DataSection = typeof ALL_DATA_SECTIONS[number]
