import { generateFilteredSummary, auditSend } from '../services/summaryService'
import { DEFAULT_PRIVACY_SETTINGS, AuditEntry } from '../types/sharing'

const weekRange = { start: new Date('2024-03-18'), end: new Date('2024-03-24') }

describe('generateFilteredSummary', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ contentPreview: 'Preview text', estimatedLength: 50 }),
    } as Response)
  })

  it('includes only sections enabled in privacy settings', async () => {
    const settings = { ...DEFAULT_PRIVACY_SETTINGS, includeMoodData: true, includeGoalProgress: true }
    const preview = await generateFilteredSummary('user1', weekRange, settings)
    expect(preview.includedSections).toContain('moodData')
    expect(preview.includedSections).toContain('goalProgress')
    expect(preview.excludedSections).toContain('journalEntries')
    expect(preview.excludedSections).toContain('sessionNotes')
  })

  it('excludes all sections when default privacy settings are used', async () => {
    const preview = await generateFilteredSummary('user1', weekRange, DEFAULT_PRIVACY_SETTINGS)
    expect(preview.includedSections).toHaveLength(0)
    expect(preview.excludedSections).toHaveLength(4)
  })

  it('applies customExclusions to already-included sections', async () => {
    const settings = {
      ...DEFAULT_PRIVACY_SETTINGS,
      includeMoodData: true,
      customExclusions: ['moodData'],
    }
    const preview = await generateFilteredSummary('user1', weekRange, settings)
    expect(preview.includedSections).not.toContain('moodData')
    expect(preview.excludedSections).toContain('moodData')
  })

  it('throws when the backend returns an error', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, statusText: 'Internal Server Error' } as Response)
    await expect(generateFilteredSummary('user1', weekRange, DEFAULT_PRIVACY_SETTINGS)).rejects.toThrow(
      'Summary generation failed',
    )
  })
})

describe('auditSend', () => {
  it('posts an audit entry to the audit endpoint', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true } as Response)
    global.fetch = mockFetch

    const entry: AuditEntry = {
      id: 'audit1',
      userId: 'user1',
      therapistId: 't1',
      sentAt: new Date(),
      includedSections: ['moodData'],
      weekRange,
      deliveryStatus: 'pending',
    }

    await auditSend(entry)

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/audit/send',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
