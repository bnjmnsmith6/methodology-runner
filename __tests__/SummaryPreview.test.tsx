import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { SummaryPreview } from '../components/SummaryPreview'
import { SummaryPreview as SummaryPreviewType } from '../types/sharing'

const makePreview = (overrides: Partial<SummaryPreviewType> = {}): SummaryPreviewType => ({
  weekRange: { start: new Date('2024-03-18'), end: new Date('2024-03-24') },
  includedSections: ['moodData', 'goalProgress'],
  excludedSections: ['journalEntries', 'sessionNotes'],
  contentPreview: 'This week you logged mood data for 5 days...',
  estimatedLength: 120,
  ...overrides,
})

describe('SummaryPreview component', () => {
  it('shows a loading state', () => {
    render(
      <SummaryPreview
        preview={null}
        loading={true}
        approved={false}
        onApprove={jest.fn()}
        onRequestChanges={jest.fn()}
        onGeneratePreview={jest.fn()}
      />,
    )
    expect(screen.getByTestId('preview-loading')).toBeInTheDocument()
  })

  it('shows generate button when no preview exists', () => {
    const onGenerate = jest.fn()
    render(
      <SummaryPreview
        preview={null}
        loading={false}
        approved={false}
        onApprove={jest.fn()}
        onRequestChanges={jest.fn()}
        onGeneratePreview={onGenerate}
      />,
    )
    fireEvent.click(screen.getByTestId('generate-preview-btn'))
    expect(onGenerate).toHaveBeenCalled()
  })

  it('displays included and excluded sections', () => {
    render(
      <SummaryPreview
        preview={makePreview()}
        loading={false}
        approved={false}
        onApprove={jest.fn()}
        onRequestChanges={jest.fn()}
        onGeneratePreview={jest.fn()}
      />,
    )
    const included = screen.getByTestId('included-sections')
    expect(included).toHaveTextContent('moodData')
    expect(included).toHaveTextContent('goalProgress')

    const excluded = screen.getByTestId('excluded-sections')
    expect(excluded).toHaveTextContent('journalEntries')
    expect(excluded).toHaveTextContent('sessionNotes')
  })

  it('excluded data does not appear in included sections list', () => {
    render(
      <SummaryPreview
        preview={makePreview()}
        loading={false}
        approved={false}
        onApprove={jest.fn()}
        onRequestChanges={jest.fn()}
        onGeneratePreview={jest.fn()}
      />,
    )
    const included = screen.getByTestId('included-sections')
    expect(included).not.toHaveTextContent('journalEntries')
    expect(included).not.toHaveTextContent('sessionNotes')
  })

  it('calls onApprove when approve button is clicked', () => {
    const onApprove = jest.fn()
    render(
      <SummaryPreview
        preview={makePreview()}
        loading={false}
        approved={false}
        onApprove={onApprove}
        onRequestChanges={jest.fn()}
        onGeneratePreview={jest.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('approve-btn'))
    expect(onApprove).toHaveBeenCalled()
  })

  it('shows approved banner when approved', () => {
    render(
      <SummaryPreview
        preview={makePreview()}
        loading={false}
        approved={true}
        onApprove={jest.fn()}
        onRequestChanges={jest.fn()}
        onGeneratePreview={jest.fn()}
      />,
    )
    expect(screen.getByTestId('preview-approved-banner')).toBeInTheDocument()
    expect(screen.queryByTestId('approve-btn')).not.toBeInTheDocument()
  })

  it('shows warning when no sections are included', () => {
    render(
      <SummaryPreview
        preview={makePreview({ includedSections: [], excludedSections: ['moodData'] })}
        loading={false}
        approved={false}
        onApprove={jest.fn()}
        onRequestChanges={jest.fn()}
        onGeneratePreview={jest.fn()}
      />,
    )
    expect(screen.getByTestId('no-sections-warning')).toBeInTheDocument()
  })
})
