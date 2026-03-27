// Main integration component — wires PrivacySettings, TherapistManager,
// SummaryPreview, and SendTrigger together using the useProgressSharing hook.

import React, { useEffect, useState } from 'react'
import { AutoSendSchedule } from '../types/sharing'
import { useProgressSharing } from '../hooks/useProgressSharing'
import { PrivacySettings } from './PrivacySettings'
import { TherapistManager } from './TherapistManager'
import { SummaryPreview } from './SummaryPreview'
import { SendTrigger } from './SendTrigger'

interface Props {
  userId: string
}

export function WeeklyProgressSharing({ userId }: Props) {
  const sharing = useProgressSharing(userId)
  const [autoSendSchedule, setAutoSendSchedule] = useState<AutoSendSchedule | null>(null)

  useEffect(() => {
    sharing.loadTherapists()
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleScheduleWeekly = (schedule: AutoSendSchedule) => {
    setAutoSendSchedule(schedule)
    // In a real app this would persist to the backend and register a cron job
  }

  const handleCancelAutoSend = () => {
    setAutoSendSchedule(null)
  }

  return (
    <main data-testid="weekly-progress-sharing">
      <h1>Weekly Progress Sharing</h1>
      <p>
        Configure which data to share, manage your therapist contacts, preview your summary,
        and send it — all with full privacy control.
      </p>

      <PrivacySettings
        initialSettings={sharing.privacySettings}
        onChange={sharing.applyPrivacyFilters}
      />

      <hr />

      <TherapistManager
        contacts={sharing.therapists}
        onAdd={sharing.addTherapist}
        onEdit={sharing.editTherapist}
        onRemove={sharing.removeTherapist}
      />

      <hr />

      <SummaryPreview
        preview={sharing.preview}
        loading={sharing.loadingPreview}
        approved={sharing.previewApproved}
        onApprove={sharing.approvePreview}
        onRequestChanges={sharing.rejectPreview}
        onGeneratePreview={() => sharing.generatePreview()}
      />

      <hr />

      <SendTrigger
        therapists={sharing.therapists}
        previewApproved={sharing.previewApproved}
        sendStatus={sharing.sendStatus}
        onSend={sharing.sendToTherapist}
        autoSendSchedule={autoSendSchedule}
        onScheduleWeekly={handleScheduleWeekly}
        onCancelAutoSend={handleCancelAutoSend}
      />

      {sharing.auditLog.length > 0 && (
        <section data-testid="audit-log">
          <h2>Send History</h2>
          <ul>
            {sharing.auditLog.map((entry) => (
              <li key={entry.id}>
                Sent to therapist {entry.therapistId} on {entry.sentAt.toLocaleString()} —{' '}
                {entry.deliveryStatus} — sections: {entry.includedSections.join(', ')}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
