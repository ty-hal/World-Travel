import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { render, screen, waitFor } from '../../tests/helpers/render'
import { server } from '../../tests/helpers/msw/server'
import TravelTimelinePage from './TravelTimelinePage'

describe('TravelTimelinePage', () => {
  it('FE-PAGE-TIMELINE-001: requests bounded pages and appends the next page', async () => {
    const offsets: string[] = []
    server.use(http.get('/api/timeline', ({ request }) => {
      const url = new URL(request.url)
      offsets.push(url.searchParams.get('offset') || '')
      return HttpResponse.json(url.searchParams.get('offset') === '50'
        ? { items: [{ id: 'second', kind: 'trip', date: '2026-01-01', title: 'Second trip' }], nextOffset: null }
        : { items: [{ id: 'first', kind: 'trip', date: '2026-02-01', title: 'First trip' }], nextOffset: 50 })
    }))

    render(<TravelTimelinePage />)
    await screen.findByText('First trip')
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }))

    await waitFor(() => expect(screen.getByText('Second trip')).toBeInTheDocument())
    expect(offsets).toEqual(['0', '50'])
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('shows a retry action when the first page fails', async () => {
    let attempts = 0
    server.use(http.get('/api/timeline', () => {
      attempts += 1
      return attempts <= 3
        ? new HttpResponse(null, { status: 503 })
        : HttpResponse.json({ items: [{ id: 'trip', kind: 'trip', date: '2026-01-01', title: 'Recovered trip' }], nextOffset: null })
    }))

    render(<TravelTimelinePage />)
    expect(await screen.findByRole('alert', {}, { timeout: 5_000 })).toHaveTextContent('could not be loaded')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Recovered trip')).toBeInTheDocument()
  })

  it('keeps existing events and retries a failed next page', async () => {
    let attempts = 0
    server.use(http.get('/api/timeline', ({ request }) => {
      const url = new URL(request.url)
      if (url.searchParams.get('offset') === '50') {
        attempts += 1
        return attempts <= 3
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json({ items: [{ id: 'second', kind: 'trip', date: '2026-01-01', title: 'Second trip' }], nextOffset: null })
      }
      return HttpResponse.json({ items: [{ id: 'first', kind: 'trip', date: '2026-02-01', title: 'First trip' }], nextOffset: 50 })
    }))

    render(<TravelTimelinePage />)
    await screen.findByText('First trip')
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(await screen.findByRole('alert', {}, { timeout: 5_000 })).toHaveTextContent('More events could not be loaded')
    expect(screen.getByText('First trip')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Second trip')).toBeInTheDocument()
  })

  it('renders country milestones as non-interactive list items', async () => {
    server.use(http.get('/api/timeline', () => HttpResponse.json({
      items: [{ id: 'visit-Italy', kind: 'country', date: '2018-06-01', title: 'Italy', subtitle: 'Country first visited' }],
      nextOffset: null,
    })))

    render(<TravelTimelinePage />)
    expect(await screen.findByText('Italy')).toBeInTheDocument()
    expect(screen.getByText('Country first visited')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Italy/ })).not.toBeInTheDocument()
  })
})
