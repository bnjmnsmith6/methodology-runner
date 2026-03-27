import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SendTrigger } from '../components/SendTrigger'
import { TherapistContact, SendStatus } from '../types/sharing'

const makeTherapist = (overrides: Partial<TherapistContact> = {}): TherapistContact => ({
  id: 't1',
  name: 'Dr. Smith',
  email: 'smith@example.com',
  isActive: true,
  addedDate: new Date('2024-01-01'),
  ...overrides,
})

const idleSendStatus: SendStatus = {
  inFlight: false,
  lastSentAt: null,
  lastStatus: 'idle',
}

const deliveredSendStatus: SendStatus = {
  inFlight: false,
  lastSentAt: new Date(),
  lastStatus: 'delivered',
}

describe('SendTrigger component', () => {
  it('shows warning when no active therapists exist', () => {
    render(
      <SendTrigger
        therapists={[]}
        previewApproved={true}
        sendStatus={idleSendStatus}
        onSend={jest.fn()}
        autoSendSchedule={null}
        onScheduleWeekly={jest.fn()}
        onCancelAutoSend={jest.fn()}
      />,
    )
    expect(screen.getByTestId('no-therapists-warning')).toBeInTheDocument()
  })

  it('disables send button when preview is not approved', () => {
    render(
      <SendTrigger
        therapists={[makeTherapist()]}
        previewApproved={false}
        sendStatus={idleSendStatus}
        onSend={jest.fn()}
        autoSendSchedule={null}
        onScheduleWeekly={jest.fn()}
        onCancelAutoSend={jest.fn()}
      />,
    )
    expect(screen.getByTestId('send-now-btn')).toBeDisabled()
    expect(screen.getByTestId('approval-required-warning')).toBeInTheDocument()
  })

  it('calls onSend when Send Now is clicked with approved preview', async () => {
    const onSend = jest.fn().mockResolvedValue(undefined)
    render(
      <SendTrigger
        therapists={[makeTherapist()]}
        previewApproved={true}
        sendStatus={idleSendStatus}
        onSend={onSend}
        autoSendSchedule={null}
        onScheduleWeekly={jest.fn()}
        onCancelAutoSend={jest.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('send-now-btn'))
    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith('t1')
    })
  })

  it('shows success status after delivery', () => {
    render(
      <SendTrigger
        therapists={[makeTherapist()]}
        previewApproved={false}
        sendStatus={deliveredSendStatus}
        onSend={jest.fn()}
        autoSendSchedule={null}
        onScheduleWeekly={jest.fn()}
        onCancelAutoSend={jest.fn()}
      />,
    )
    expect(screen.getByTestId('send-status-banner')).toHaveTextContent('Summary sent')
  })

  it('can set up and cancel auto-send schedule', async () => {
    const onScheduleWeekly = jest.fn()
    const onCancelAutoSend = jest.fn()
    render(
      <SendTrigger
        therapists={[makeTherapist()]}
        previewApproved={true}
        sendStatus={idleSendStatus}
        onSend={jest.fn()}
        autoSendSchedule={null}
        onScheduleWeekly={onScheduleWeekly}
        onCancelAutoSend={onCancelAutoSend}
      />,
    )
    fireEvent.click(screen.getByTestId('toggle-scheduler-btn'))
    expect(screen.getByTestId('scheduler-form')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('save-schedule-btn'))
    expect(onScheduleWeekly).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, therapistIds: ['t1'] }),
    )
  })

  it('inactive therapists are not shown in the send dropdown', () => {
    render(
      <SendTrigger
        therapists={[
          makeTherapist({ id: 't1', name: 'Dr. Active', isActive: true }),
          makeTherapist({ id: 't2', name: 'Dr. Inactive', isActive: false }),
        ]}
        previewApproved={true}
        sendStatus={idleSendStatus}
        onSend={jest.fn()}
        autoSendSchedule={null}
        onScheduleWeekly={jest.fn()}
        onCancelAutoSend={jest.fn()}
      />,
    )
    expect(screen.queryByText(/Dr. Inactive/)).not.toBeInTheDocument()
    expect(screen.getByText(/Dr. Active/)).toBeInTheDocument()
  })
})
