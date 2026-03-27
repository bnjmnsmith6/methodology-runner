import React, { useState } from 'react'
import { TherapistContact } from '../types/sharing'

interface Props {
  contacts: TherapistContact[]
  onAdd: (contact: Omit<TherapistContact, 'id' | 'addedDate'>) => Promise<void>
  onEdit: (contact: TherapistContact) => Promise<void>
  onRemove: (id: string) => Promise<void>
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateContact(
  contact: Pick<TherapistContact, 'name' | 'email'>,
): string[] {
  const errors: string[] = []
  if (!contact.name.trim()) errors.push('Name is required')
  if (!contact.email.trim()) {
    errors.push('Email is required')
  } else if (!EMAIL_RE.test(contact.email)) {
    errors.push('Email must be a valid address')
  }
  return errors
}

interface ContactFormState {
  name: string
  email: string
  notes: string
  isActive: boolean
}

const EMPTY_FORM: ContactFormState = { name: '', email: '', notes: '', isActive: true }

export function TherapistManager({ contacts, onAdd, onEdit, onRemove }: Props) {
  const [form, setForm] = useState<ContactFormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationErrors = validateContact({ name: form.name, email: form.email })
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors([])
    setSaving(true)
    try {
      if (editingId) {
        const existing = contacts.find((c) => c.id === editingId)!
        await onEdit({
          ...existing,
          name: form.name,
          email: form.email,
          encryptedNotes: form.notes || undefined,
          isActive: form.isActive,
        })
        setEditingId(null)
      } else {
        await onAdd({
          name: form.name,
          email: form.email,
          encryptedNotes: form.notes || undefined,
          isActive: form.isActive,
        })
      }
      setForm(EMPTY_FORM)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (contact: TherapistContact) => {
    setEditingId(contact.id)
    setForm({
      name: contact.name,
      email: contact.email,
      notes: contact.encryptedNotes ?? '',
      isActive: contact.isActive,
    })
    setErrors([])
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setErrors([])
  }

  const addTherapist = handleSubmit
  const editTherapist = handleSubmit
  const removeTherapist = onRemove

  return (
    <section aria-label="Therapist Contacts" data-testid="therapist-manager">
      <h2>Therapist Contacts</h2>

      <ul data-testid="therapist-list">
        {contacts.map((contact) => (
          <li key={contact.id} data-testid={`therapist-${contact.id}`}>
            <strong>{contact.name}</strong> &lt;{contact.email}&gt;
            {!contact.isActive && <span> (inactive)</span>}
            <button onClick={() => startEdit(contact)} aria-label={`Edit ${contact.name}`}>
              Edit
            </button>
            <button
              onClick={() => removeTherapist(contact.id)}
              aria-label={`Remove ${contact.name}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={editingId ? editTherapist : addTherapist} data-testid="therapist-form">
        <h3>{editingId ? 'Edit Therapist' : 'Add Therapist'}</h3>

        <div>
          <label htmlFor="therapist-name">Name</label>
          <input
            id="therapist-name"
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            data-testid="therapist-name-input"
          />
        </div>

        <div>
          <label htmlFor="therapist-email">Email</label>
          <input
            id="therapist-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            data-testid="therapist-email-input"
          />
        </div>

        <div>
          <label htmlFor="therapist-notes">Notes (encrypted)</label>
          <textarea
            id="therapist-notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            data-testid="therapist-notes-input"
          />
        </div>

        <div>
          <label>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              data-testid="therapist-active-toggle"
            />
            &nbsp;Active
          </label>
        </div>

        {errors.length > 0 && (
          <ul role="alert" data-testid="therapist-errors">
            {errors.map((err) => (
              <li key={err} style={{ color: 'red' }}>
                {err}
              </li>
            ))}
          </ul>
        )}

        <button type="submit" disabled={saving} data-testid="therapist-submit-btn">
          {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add therapist'}
        </button>
        {editingId && (
          <button type="button" onClick={cancelEdit} data-testid="therapist-cancel-btn">
            Cancel
          </button>
        )}
      </form>
    </section>
  )
}
