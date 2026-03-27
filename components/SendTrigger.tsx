import React, { useState } from 'react'
import { TherapistContact, AutoSendSchedule, SendStatus } from '../types/sharing'

interface Props {
  therapists: TherapistContact[]
  previewApproved: boolean
  sendStatus: SendStatus
  onSend: (therapistId: string) => Promise<void>
  autoSendSchedule: AutoSendSchedule | null
  onScheduleWeekly: (schedule: AutoSendSchedule) => void
  onCancelAutoSend: () => void
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function SendTrigger({
  therapists,
  previewApproved,
  sendStatus,
  onSend,
  autoSendSchedule,
  onScheduleWeekly,
  onCancelAutoSend,
}: Props) {
  const activeTherapists = therapists.filter((t) => t.isActive)
  const [selectedTherapistId, setSelectedTherapistId] = useState(
    activeTherapists[0]?.id ?? '',
  )
  const [scheduleDay, setScheduleDay] = useState<number>(1)
  const [scheduleHour, setScheduleHour] = useState<number>(9)
  const [showScheduler, setShowScheduler] = useState(false)
  const [sending, setSending] = useState(false)

  const triggerSend = async () => {
    if (!selectedTherapistId) return
    setSending(true)
    try {
      await onSend(selectedTherapistId)
    } finally {
      setSending(false)
    }
  }

  const scheduleWeekly = () => {
    if (!selectedTherapistId) return
    const schedule: AutoSendSchedule = {
      enabled: true,
      dayOfWeek: scheduleDay as AutoSendSchedule['dayOfWeek'],
      hour: scheduleHour,
      therapistIds: [selectedTherapistId],
    }
    onScheduleWeekly(schedule)
    setShowScheduler(false)
  }

  const cancelSend = () => {
    onCancelAutoSend()
  }

  const canSend = previewApproved && !!selectedTherapistId && !sendStatus.inFlight

  return (
    <section aria-label="Send Summary" data-testid="send-trigger">
      <h2>Send Weekly Summary</h2>

      {activeTherapists.length === 0 ? (
        <p data-testid="no-therapists-warning">
          Add an active therapist contact before sending.
        </p>
      ) : (
        <>
          <div>
            <label htmlFor="therapist-select">Send to</label>
            <select
              id="therapist-select"
              value={selectedTherapistId}
              onChange={(e) => setSelectedTherapistId(e.target.value)}
              data-testid="therapist-select"
            >
              {activeTherapists.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.email})
                </option>
              ))}
            </select>
          </div>

          {!previewApproved && (
            <p data-testid="approval-required-warning" style={{ color: 'orange' }}>
              You must preview and approve the summary before sending.
            </p>
          )}

          <button
            onClick={triggerSend}
            disabled={!canSend || sending}
            data-testid="send-now-btn"
          >
            {sending ? 'Sending…' : 'Send Now'}
          </button>

          <button
            onClick={() => setShowScheduler((v) => !v)}
            data-testid="toggle-scheduler-btn"
          >
            {autoSendSchedule?.enabled ? 'Modify Auto-Send' : 'Set Up Weekly Auto-Send'}
          </button>

          {autoSendSchedule?.enabled && (
            <div data-testid="auto-send-status">
              <p>
                Auto-send active: every {DAY_NAMES[autoSendSchedule.dayOfWeek]} at{' '}
                {String(autoSendSchedule.hour).padStart(2, '0')}:00
              </p>
              <button onClick={cancelSend} data-testid="cancel-auto-send-btn">
                Cancel Auto-Send
              </button>
            </div>
          )}

          {showScheduler && (
            <div data-testid="scheduler-form">
              <h3>Auto-Send Schedule</h3>
              <div>
                <label htmlFor="schedule-day">Day of week</label>
                <select
                  id="schedule-day"
                  value={scheduleDay}
                  onChange={(e) => setScheduleDay(Number(e.target.value))}
                  data-testid="schedule-day-select"
                >
                  {DAY_NAMES.map((name, i) => (
                    <option key={name} value={i}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="schedule-hour">Hour (24h)</label>
                <input
                  id="schedule-hour"
                  type="number"
                  min={0}
                  max={23}
                  value={scheduleHour}
                  onChange={(e) => setScheduleHour(Number(e.target.value))}
                  data-testid="schedule-hour-input"
                />
              </div>
              <button onClick={scheduleWeekly} data-testid="save-schedule-btn">
                Save Schedule
              </button>
              <button onClick={() => setShowScheduler(false)} data-testid="cancel-schedule-btn">
                Cancel
              </button>
            </div>
          )}
        </>
      )}

      {sendStatus.lastStatus !== 'idle' && (
        <div
          data-testid="send-status-banner"
          style={{ color: sendStatus.lastStatus === 'delivered' ? 'green' : 'red' }}
        >
          {sendStatus.lastStatus === 'delivered' && `✓ Summary sent at ${sendStatus.lastSentAt?.toLocaleTimeString()}`}
          {sendStatus.lastStatus === 'failed' && `Send failed: ${sendStatus.errorMessage}`}
          {sendStatus.lastStatus === 'pending' && 'Sending…'}
        </div>
      )}
    </section>
  )
}
