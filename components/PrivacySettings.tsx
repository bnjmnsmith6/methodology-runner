import React, { useState, useCallback } from 'react'
import { PrivacySettings as PrivacySettingsType, DEFAULT_PRIVACY_SETTINGS } from '../types/sharing'

interface Props {
  initialSettings?: PrivacySettingsType
  onChange: (settings: PrivacySettingsType) => void
}

export function validateSettings(settings: PrivacySettingsType): string[] {
  const errors: string[] = []
  for (const exclusion of settings.customExclusions) {
    if (!exclusion.trim()) {
      errors.push('Custom exclusion entries cannot be blank')
    }
  }
  return errors
}

export function PrivacySettings({ initialSettings, onChange }: Props) {
  const [settings, setSettings] = useState<PrivacySettingsType>(
    initialSettings ?? DEFAULT_PRIVACY_SETTINGS,
  )
  const [newExclusion, setNewExclusion] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  const updatePrivacySettings = useCallback(
    (patch: Partial<PrivacySettingsType>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch }
        const validationErrors = validateSettings(next)
        setErrors(validationErrors)
        if (validationErrors.length === 0) {
          onChange(next)
        }
        return next
      })
    },
    [onChange],
  )

  const addCustomExclusion = () => {
    const trimmed = newExclusion.trim()
    if (!trimmed || settings.customExclusions.includes(trimmed)) return
    updatePrivacySettings({ customExclusions: [...settings.customExclusions, trimmed] })
    setNewExclusion('')
  }

  const removeCustomExclusion = (exclusion: string) => {
    updatePrivacySettings({
      customExclusions: settings.customExclusions.filter((e) => e !== exclusion),
    })
  }

  const toggleField =
    (field: keyof Pick<
      PrivacySettingsType,
      'includeJournalEntries' | 'includeMoodData' | 'includeGoalProgress' | 'includeSessionNotes'
    >) =>
    () =>
      updatePrivacySettings({ [field]: !settings[field] })

  return (
    <section aria-label="Privacy Settings" data-testid="privacy-settings">
      <h2>Privacy Settings</h2>
      <p>Choose which data to include in summaries sent to your therapist.</p>

      <div>
        <label>
          <input
            type="checkbox"
            checked={settings.includeJournalEntries}
            onChange={toggleField('includeJournalEntries')}
            data-testid="toggle-journal"
          />
          &nbsp;Journal entries
        </label>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={settings.includeMoodData}
            onChange={toggleField('includeMoodData')}
            data-testid="toggle-mood"
          />
          &nbsp;Mood data
        </label>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={settings.includeGoalProgress}
            onChange={toggleField('includeGoalProgress')}
            data-testid="toggle-goals"
          />
          &nbsp;Goal progress
        </label>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={settings.includeSessionNotes}
            onChange={toggleField('includeSessionNotes')}
            data-testid="toggle-session-notes"
          />
          &nbsp;Session notes
        </label>
      </div>

      <div>
        <h3>Custom exclusions</h3>
        <ul data-testid="custom-exclusions-list">
          {settings.customExclusions.map((exclusion) => (
            <li key={exclusion}>
              {exclusion}
              <button
                onClick={() => removeCustomExclusion(exclusion)}
                aria-label={`Remove ${exclusion}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <input
          type="text"
          value={newExclusion}
          onChange={(e) => setNewExclusion(e.target.value)}
          placeholder="Add custom exclusion"
          data-testid="custom-exclusion-input"
          onKeyDown={(e) => e.key === 'Enter' && addCustomExclusion()}
        />
        <button onClick={addCustomExclusion} data-testid="add-exclusion-btn">
          Add
        </button>
      </div>

      {errors.length > 0 && (
        <ul role="alert" data-testid="privacy-errors">
          {errors.map((err) => (
            <li key={err} style={{ color: 'red' }}>
              {err}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
