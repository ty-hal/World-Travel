import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../tests/helpers/msw/server'
import { subscribeAtlasPhotos, warmAtlasPhotos, type AtlasPhotoTarget } from './atlasPhotos'
import WonderDetailDrawer from './WonderDetailDrawer'

describe('Atlas photo warming', () => {
  afterEach(() => server.resetHandlers())

  it('prefetches carousel photos once and serves the warm result to the drawer', async () => {
    let searchCalls = 0
    let mapPhotoCalls = 0
    server.use(
      http.get('/api/trips/cover-images/search', () => {
        searchCalls++
        return HttpResponse.json({ photos: [{ url: 'https://images.example/full.jpg', thumb: 'https://images.example/thumb.jpg' }] })
      }),
      http.get('/api/maps/place-photo/:placeId', () => {
        mapPhotoCalls++
        return HttpResponse.json({ photoUrl: '/api/maps/place-photo/cached/bytes', attribution: null })
      }),
    )
    const target: AtlasPhotoTarget = { key: 'wonder:photo-cache-test', query: 'Test Wonder', lat: 1, lng: 2 }

    await warmAtlasPhotos([target])
    const updates: string[][] = []
    const unsubscribe = subscribeAtlasPhotos(target, photos => updates.push(photos))
    await warmAtlasPhotos([target])

    expect(updates[updates.length - 1]).toEqual(expect.arrayContaining(['/api/maps/place-photo/cached/bytes', 'https://images.example/thumb.jpg']))
    expect(updates[updates.length - 1]).toHaveLength(2)
    expect(searchCalls).toBe(1)
    expect(mapPhotoCalls).toBe(1)

    render(<WonderDetailDrawer
      place={{ type: 'wonder', item: { source_id: 'photo-cache-test', label: 'Test Wonder', lat: 1, lng: 2 } }}
      onClose={() => {}}
      onFocusMap={() => {}}
      t={key => key}
      dark={false}
    />)
    const firstImage = screen.getByRole('img', { name: 'Test Wonder, image 1' })
    const firstImageUrl = firstImage.getAttribute('src')
    expect(firstImageUrl).toMatch(/cached\/bytes|thumb\.jpg/)
    fireEvent.click(screen.getByRole('button', { name: 'Next image' }))
    expect(screen.getByRole('img', { name: 'Test Wonder, image 2' }).getAttribute('src')).not.toBe(firstImageUrl)
    unsubscribe()
  })
})
