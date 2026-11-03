import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

vi.mock('./api/client', () => ({
  api: { get: vi.fn().mockRejectedValue(new Error('offline')) },
}))

describe('public navigation', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    window.scrollTo = vi.fn()
  })

  it('exposes the explanatory page as a link and keeps in-app navigation', () => {
    render(<App />)
    const link = screen.getByRole('link', { name: 'How it works' })
    expect(link).toHaveAttribute('href', '/how-it-works')

    fireEvent.click(link)
    expect(window.location.pathname).toBe('/how-it-works')
    expect(screen.getByRole('heading', { name: 'A visual route instead of one typed secret.' })).toBeInTheDocument()
  })
})
