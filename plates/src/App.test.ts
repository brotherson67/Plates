import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import App from './App.svelte'

describe('App (integration: Konsta shell + WorkoutSummary + workout math)', () => {
  it('renders the navbar title and the sample workout together', () => {
    render(App)
    expect(screen.getByText('Plates')).toBeInTheDocument()
    expect(screen.getByText('Squat')).toBeInTheDocument()
    expect(screen.getByText('Bench Press')).toBeInTheDocument()
    expect(screen.getByTestId('workout-total')).toBeInTheDocument()
  })
})
