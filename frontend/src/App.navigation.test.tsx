import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

vi.mock('./api/client', () => ({
  api: { get: vi.fn().mockRejectedValue(new Error('offline')) },
}))

describe('public navigation', () => {
  afterEach(cleanup)
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    window.scrollTo = vi.fn()
  })

  it('refreshes metadata when an unknown homepage view navigates to the root', () => {
    window.history.replaceState({}, '', '/not-a-scenechain-route')
    render(<App />)
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow')
    fireEvent.click(screen.getByRole('link', { name: 'Overview' }))
    expect(window.location.pathname).toBe('/')
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'index,follow')
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://scenechain.elfeel.me/')
  })

  it('refreshes metadata on same-view history transitions', () => {
    render(<App />)
    act(() => {
      window.history.replaceState({}, '', '/not-a-scenechain-route')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow')
    act(() => {
      window.history.replaceState({}, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'index,follow')
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://scenechain.elfeel.me/')
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
