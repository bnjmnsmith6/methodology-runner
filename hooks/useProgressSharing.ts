import { useState, useCallback } from 'react'
import {
  PrivacySettings,
  TherapistContact,
  SummaryPreview,
  AuditEntry,
  SendStatus,
  DateRange,
  DEFAULT_PRIVACY_SETTINGS,
} from '../types/sharing'
import {
  generateFilteredSummary,
  deliverSummary,
  saveTherapistContact,
  updateTherapistContact,
  deleteTherapistContact,
  listTherapistContacts,
} from '../services/summaryService'

function getCurrentWeekRange(): DateRange {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const start = new Date(now)
  start.setDate(now.getDate() - dayOfWeek)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

export function useProgressSharing(userId: string) {
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(DEFAULT_PRIVACY_SETTINGS)
  const [therapists, setTherapists] = useState<TherapistContact[]>([])
  const [preview, setPreview] = useState<SummaryPreview | null>(null)
  const [previewApproved, setPreviewApproved] = useState(false)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [sendStatus, setSendStatus] = useState<SendStatus>({
    inFlight: false,
    lastSentAt: null,
    lastStatus: 'idle',
  })
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingTherapists, setLoadingTherapists] = useState(false)

  // --- Privacy ---

  const applyPrivacyFilters = useCallback((settings: PrivacySettings) => {
    setPrivacySettings(settings)
    // Changing privacy settings invalidates any existing preview/approval
    setPreview(null)
    setPreviewApproved(false)
  }, [])

  // --- Therapist management ---

  const loadTherapists = useCallback(async () => {
    setLoadingTherapists(true)
    try {
      const contacts = await listTherapistContacts()
      setTherapists(contacts)
    } finally {
      setLoadingTherapists(false)
    }
  }, [])

  const addTherapist = useCallback(
    async (contact: Omit<TherapistContact, 'id' | 'addedDate'>) => {
      const newContact: TherapistContact = {
        ...contact,
        id: crypto.randomUUID(),
        addedDate: new Date(),
      }
      await saveTherapistContact(newContact)
      setTherapists((prev) => [...prev, newContact])
    },
    [],
  )

  const editTherapist = useCallback(async (contact: TherapistContact) => {
    await updateTherapistContact(contact)
    setTherapists((prev) => prev.map((c) => (c.id === contact.id ? contact : c)))
  }, [])

  const removeTherapist = useCallback(async (id: string) => {
    await deleteTherapistContact(id)
    setTherapists((prev) => prev.filter((c) => c.id !== id))
  }, [])

  // --- Preview ---

  const generatePreview = useCallback(
    async (weekRange?: DateRange) => {
      const range = weekRange ?? getCurrentWeekRange()
      setLoadingPreview(true)
      setPreviewApproved(false)
      try {
        const result = await generateFilteredSummary(userId, range, privacySettings)
        setPreview(result)
      } finally {
        setLoadingPreview(false)
      }
    },
    [userId, privacySettings],
  )

  const approvePreview = useCallback(() => {
    if (!preview) throw new Error('No preview to approve')
    setPreviewApproved(true)
  }, [preview])

  const rejectPreview = useCallback(() => {
    setPreviewApproved(false)
    setPreview(null)
  }, [])

  // --- Send ---

  const sendToTherapist = useCallback(
    async (therapistId: string) => {
      if (!preview) throw new Error('Generate and approve a preview before sending')
      if (!previewApproved) throw new Error('Preview must be approved before sending')

      const therapist = therapists.find((t) => t.id === therapistId)
      if (!therapist) throw new Error(`Therapist ${therapistId} not found`)
      if (!therapist.isActive) throw new Error('Cannot send to inactive therapist')

      setSendStatus({ inFlight: true, lastSentAt: null, lastStatus: 'pending' })
      try {
        const entry = await deliverSummary(preview, therapist, userId)
        setAuditLog((prev) => [...prev, entry])
        setSendStatus({ inFlight: false, lastSentAt: new Date(), lastStatus: 'delivered' })
        // Reset approval after successful send so the user must re-approve next time
        setPreviewApproved(false)
        return entry
      } catch (err) {
        setSendStatus({
          inFlight: false,
          lastSentAt: null,
          lastStatus: 'failed',
          errorMessage: err instanceof Error ? err.message : String(err),
        })
        throw err
      }
    },
    [preview, previewApproved, therapists, userId],
  )

  const trackSendStatus = useCallback(() => sendStatus, [sendStatus])

  return {
    // State
    privacySettings,
    therapists,
    preview,
    previewApproved,
    auditLog,
    sendStatus,
    loadingPreview,
    loadingTherapists,
    // Actions
    applyPrivacyFilters,
    loadTherapists,
    addTherapist,
    editTherapist,
    removeTherapist,
    generatePreview,
    approvePreview,
    rejectPreview,
    sendToTherapist,
    trackSendStatus,
  }
}
