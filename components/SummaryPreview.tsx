import React from 'react'
import { SummaryPreview as SummaryPreviewType } from '../types/sharing'

interface Props {
  preview: SummaryPreviewType | null
  loading: boolean
  approved: boolean
  onApprove: () => void
  onRequestChanges: () => void
  onGeneratePreview: () => void
}

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function SummaryPreview({
  preview,
  loading,
  approved,
  onApprove,
  onRequestChanges,
  onGeneratePreview,
}: Props) {
  if (loading) {
    return (
      <section data-testid="summary-preview" aria-label="Summary Preview">
        <p data-testid="preview-loading">Generating preview…</p>
      </section>
    )
  }

  if (!preview) {
    return (
      <section data-testid="summary-preview" aria-label="Summary Preview">
        <p>No preview generated yet.</p>
        <button onClick={onGeneratePreview} data-testid="generate-preview-btn">
          Generate Preview
        </button>
      </section>
    )
  }

  const { weekRange, includedSections, excludedSections, contentPreview, estimatedLength } = preview

  return (
    <section data-testid="summary-preview" aria-label="Summary Preview">
      <h2>Weekly Summary Preview</h2>
      <p data-testid="preview-week-range">
        Week of {formatDate(weekRange.start)} – {formatDate(weekRange.end)}
      </p>

      <div>
        <h3>Included sections</h3>
        {includedSections.length > 0 ? (
          <ul data-testid="included-sections">
            {includedSections.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        ) : (
          <p data-testid="no-sections-warning" style={{ color: 'orange' }}>
            No sections selected — the summary will be empty. Adjust your privacy settings.
          </p>
        )}
      </div>

      {excludedSections.length > 0 && (
        <div>
          <h3>Excluded sections</h3>
          <ul data-testid="excluded-sections">
            {excludedSections.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3>Content preview</h3>
        <pre
          data-testid="content-preview"
          style={{ whiteSpace: 'pre-wrap', border: '1px solid #ccc', padding: '1rem' }}
        >
          {contentPreview}
        </pre>
        <p data-testid="estimated-length">Estimated length: ~{estimatedLength} words</p>
      </div>

      {approved ? (
        <div data-testid="preview-approved-banner" style={{ color: 'green' }}>
          ✓ Approved for sending
          <button onClick={onRequestChanges} data-testid="revoke-approval-btn">
            Revoke approval
          </button>
        </div>
      ) : (
        <div data-testid="preview-actions">
          <button onClick={onApprove} data-testid="approve-btn">
            Approve &amp; Ready to Send
          </button>
          <button onClick={onRequestChanges} data-testid="request-changes-btn">
            Request Changes
          </button>
        </div>
      )}

      <button onClick={onGeneratePreview} data-testid="regenerate-preview-btn">
        Regenerate Preview
      </button>
    </section>
  )
}
