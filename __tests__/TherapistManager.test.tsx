import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TherapistManager, validateContact } from '../components/TherapistManager'
import { TherapistContact } from '../types/sharing'

const makeContact = (overrides: Partial<TherapistContact> = {}): TherapistContact => ({
  id: 't1',
  name: 'Dr. Smith',
  email: 'smith@example.com',
  isActive: true,
  addedDate: new Date('2024-01-01'),
  ...overrides,
})

describe('validateContact', () => {
  it('accepts a valid contact', () => {
    expect(validateContact({ name: 'Dr. Jones', email: 'jones@clinic.com' })).toHaveLength(0)
  })

  it('requires a name', () => {
    expect(validateContact({ name: '', email: 'jones@clinic.com' })).toContain('Name is required')
  })

  it('requires a valid email', () => {
    expect(validateContact({ name: 'Dr. Jones', email: 'not-an-email' })).toContain(
      'Email must be a valid address',
    )
  })

  it('requires email to be present', () => {
    expect(validateContact({ name: 'Dr. Jones', email: '' })).toContain('Email is required')
  })
})

describe('TherapistManager component', () => {
  it('renders existing contacts', () => {
    render(
      <TherapistManager
        contacts={[makeContact()]}
        onAdd={jest.fn()}
        onEdit={jest.fn()}
        onRemove={jest.fn()}
      />,
    )
    expect(screen.getByText(/Dr. Smith/)).toBeInTheDocument()
  })

  it('calls onAdd with correct data when form is submitted', async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined)
    render(
      <TherapistManager contacts={[]} onAdd={onAdd} onEdit={jest.fn()} onRemove={jest.fn()} />,
    )
    fireEvent.change(screen.getByTestId('therapist-name-input'), {
      target: { value: 'Dr. Jones' },
    })
    fireEvent.change(screen.getByTestId('therapist-email-input'), {
      target: { value: 'jones@clinic.com' },
    })
    fireEvent.click(screen.getByTestId('therapist-submit-btn'))
    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Dr. Jones', email: 'jones@clinic.com', isActive: true }),
      )
    })
  })

  it('shows validation errors for invalid input', async () => {
    render(
      <TherapistManager contacts={[]} onAdd={jest.fn()} onEdit={jest.fn()} onRemove={jest.fn()} />,
    )
    fireEvent.click(screen.getByTestId('therapist-submit-btn'))
    expect(await screen.findByTestId('therapist-errors')).toBeInTheDocument()
    expect(screen.getByText('Name is required')).toBeInTheDocument()
  })

  it('calls onRemove when Remove is clicked', () => {
    const onRemove = jest.fn()
    render(
      <TherapistManager
        contacts={[makeContact()]}
        onAdd={jest.fn()}
        onEdit={jest.fn()}
        onRemove={onRemove}
      />,
    )
    fireEvent.click(screen.getByLabelText('Remove Dr. Smith'))
    expect(onRemove).toHaveBeenCalledWith('t1')
  })

  it('populates the form when Edit is clicked', () => {
    render(
      <TherapistManager
        contacts={[makeContact()]}
        onAdd={jest.fn()}
        onEdit={jest.fn()}
        onRemove={jest.fn()}
      />,
    )
    fireEvent.click(screen.getByLabelText('Edit Dr. Smith'))
    expect(screen.getByTestId('therapist-name-input')).toHaveValue('Dr. Smith')
    expect(screen.getByTestId('therapist-email-input')).toHaveValue('smith@example.com')
  })
})
