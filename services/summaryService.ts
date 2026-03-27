// Service layer for weekly progress summary generation and delivery
// Integrates with the existing Mirror Mind data analysis and extraction system

import {
  PrivacySettings,
  TherapistContact,
  SummaryPreview,
  AuditEntry,
  DateRange,
} from '../types/sharing'

// --- Encryption helpers (thin wrappers around Web Crypto API) ---

export async function encryptText(plaintext: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plaintext)
  // In production this key would be derived from the user's credentials
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  const exportedKey = await crypto.subtle.exportKey('raw', key)
  // Encode iv + key + ciphertext as a single base64 blob for storage
  const combined = new Uint8Array(iv.byteLength + exportedKey.byteLength + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(exportedKey), iv.byteLength)
  combined.set(new Uint8Array(encrypted), iv.byteLength + exportedKey.byteLength)
  return btoa(String.fromCharCode(...combined))
}

export async function decryptText(ciphertext: string): Promise<string> {
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const rawKey = combined.slice(12, 44)
  const data = combined.slice(44)
  const key = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt'])
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(decrypted)
}

// --- Summary generation ---

/**
 * Calls the existing data-analysis service and applies privacy filters before
 * returning a preview.  The actual generation is delegated to the backend;
 * this function is the integration seam.
 */
export async function generateFilteredSummary(
  userId: string,
  weekRange: DateRange,
  privacySettings: PrivacySettings,
): Promise<SummaryPreview> {
  const includedSections: string[] = []
  const excludedSections: string[] = []

  if (privacySettings.includeJournalEntries) {
    includedSections.push('journalEntries')
  } else {
    excludedSections.push('journalEntries')
  }
  if (privacySettings.includeMoodData) {
    includedSections.push('moodData')
  } else {
    excludedSections.push('moodData')
  }
  if (privacySettings.includeGoalProgress) {
    includedSections.push('goalProgress')
  } else {
    excludedSections.push('goalProgress')
  }
  if (privacySettings.includeSessionNotes) {
    includedSections.push('sessionNotes')
  } else {
    excludedSections.push('sessionNotes')
  }

  // Remove anything the user explicitly excluded
  for (const exclusion of privacySettings.customExclusions) {
    const idx = includedSections.indexOf(exclusion)
    if (idx !== -1) {
      includedSections.splice(idx, 1)
      excludedSections.push(exclusion)
    }
  }

  // Delegate to the backend data-analysis service
  const response = await fetch('/api/summary/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, weekRange, includedSections }),
  })

  if (!response.ok) {
    throw new Error(`Summary generation failed: ${response.statusText}`)
  }

  const { contentPreview, estimatedLength } = await response.json()

  return {
    weekRange,
    includedSections,
    excludedSections,
    contentPreview,
    estimatedLength,
  }
}

// --- Delivery ---

export async function deliverSummary(
  summary: SummaryPreview,
  therapist: TherapistContact,
  userId: string,
): Promise<AuditEntry> {
  const response = await fetch('/api/summary/deliver', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      therapistEmail: therapist.email,
      therapistName: therapist.name,
      summary,
      userId,
    }),
  })

  if (!response.ok) {
    throw new Error(`Delivery failed: ${response.statusText}`)
  }

  const { deliveryId } = await response.json()

  const auditEntry: AuditEntry = {
    id: deliveryId,
    userId,
    therapistId: therapist.id,
    sentAt: new Date(),
    includedSections: summary.includedSections,
    weekRange: summary.weekRange,
    deliveryStatus: 'pending',
  }

  await auditSend(auditEntry)
  return auditEntry
}

// --- Audit ---

export async function auditSend(entry: AuditEntry): Promise<void> {
  await fetch('/api/audit/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  })
}

// --- Therapist contact persistence ---

export async function saveTherapistContact(contact: TherapistContact): Promise<void> {
  const encrypted: TherapistContact = {
    ...contact,
    encryptedNotes: contact.encryptedNotes
      ? await encryptText(contact.encryptedNotes)
      : undefined,
  }
  await fetch('/api/therapists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(encrypted),
  })
}

export async function updateTherapistContact(contact: TherapistContact): Promise<void> {
  const encrypted: TherapistContact = {
    ...contact,
    encryptedNotes: contact.encryptedNotes
      ? await encryptText(contact.encryptedNotes)
      : undefined,
  }
  await fetch(`/api/therapists/${contact.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(encrypted),
  })
}

export async function deleteTherapistContact(id: string): Promise<void> {
  await fetch(`/api/therapists/${id}`, { method: 'DELETE' })
}

export async function listTherapistContacts(): Promise<TherapistContact[]> {
  const response = await fetch('/api/therapists')
  if (!response.ok) {
    throw new Error('Failed to load therapist contacts')
  }
  return response.json()
}
