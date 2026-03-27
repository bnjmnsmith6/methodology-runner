import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { PrivacySettings, validateSettings } from '../components/PrivacySettings'
import { DEFAULT_PRIVACY_SETTINGS, PrivacySettings as PrivacySettingsType } from '../types/sharing'

describe('validateSettings', () => {
  it('returns no errors for valid settings', () => {
    expect(validateSettings(DEFAULT_PRIVACY_SETTINGS)).toHaveLength(0)
  })

  it('returns an error for blank custom exclusions', () => {
    const settings: PrivacySettingsType = { ...DEFAULT_PRIVACY_SETTINGS, customExclusions: [''] }
    expect(validateSettings(settings)).toContain('Custom exclusion entries cannot be blank')
  })
})

describe('PrivacySettings component', () => {
  it('renders all data category toggles', () => {
    render(<PrivacySettings onChange={jest.fn()} />)
    expect(screen.getByTestId('toggle-journal')).toBeInTheDocument()
    expect(screen.getByTestId('toggle-mood')).toBeInTheDocument()
    expect(screen.getByTestId('toggle-goals')).toBeInTheDocument()
    expect(screen.getByTestId('toggle-session-notes')).toBeInTheDocument()
  })

  it('starts with all toggles unchecked (maximum privacy by default)', () => {
    render(<PrivacySettings onChange={jest.fn()} />)
    expect(screen.getByTestId('toggle-journal')).not.toBeChecked()
    expect(screen.getByTestId('toggle-mood')).not.toBeChecked()
    expect(screen.getByTestId('toggle-goals')).not.toBeChecked()
    expect(screen.getByTestId('toggle-session-notes')).not.toBeChecked()
  })

  it('calls onChange when a toggle is clicked', () => {
    const onChange = jest.fn()
    render(<PrivacySettings onChange={onChange} />)
    fireEvent.click(screen.getByTestId('toggle-mood'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ includeMoodData: true }),
    )
  })

  it('adds and removes custom exclusions', () => {
    const onChange = jest.fn()
    render(<PrivacySettings onChange={onChange} />)
    const input = screen.getByTestId('custom-exclusion-input')
    fireEvent.change(input, { target: { value: 'sensitiveField' } })
    fireEvent.click(screen.getByTestId('add-exclusion-btn'))
    expect(screen.getByText('sensitiveField')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Remove sensitiveField'))
    expect(screen.queryByText('sensitiveField')).not.toBeInTheDocument()
  })

  it('excluded data does not appear in included list after toggle off', () => {
    const onChange = jest.fn()
    render(<PrivacySettings onChange={onChange} />)
    // Turn on mood
    fireEvent.click(screen.getByTestId('toggle-mood'))
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeMoodData: true }),
    )
    // Turn off mood
    fireEvent.click(screen.getByTestId('toggle-mood'))
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ includeMoodData: false }),
    )
  })
})
