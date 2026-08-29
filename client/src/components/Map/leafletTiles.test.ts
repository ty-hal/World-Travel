import { describe, expect, it } from 'vitest'
import {
  OPENSTREETMAP_TILE_URL,
  atlasLeafletTileUrl,
  atlasMaxBounds,
  atlasUnvisitedLandFill,
  atlasWorldZoom,
  ATLAS_WORLD_LAT,
  isFreeLeafletTileUrl,
  resolveLeafletTileUrl,
} from './leafletTiles'

describe('leafletTiles', () => {
  it('treats OSM as free', () => {
    expect(isFreeLeafletTileUrl(OPENSTREETMAP_TILE_URL)).toBe(true)
    expect(resolveLeafletTileUrl(OPENSTREETMAP_TILE_URL)).toBe(OPENSTREETMAP_TILE_URL)
  })

  it('rejects Carto basemaps that now require API keys', () => {
    const carto = 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png'
    expect(isFreeLeafletTileUrl(carto)).toBe(false)
    expect(resolveLeafletTileUrl(carto)).toBe(OPENSTREETMAP_TILE_URL)
    expect(atlasLeafletTileUrl(carto)).toBe(OPENSTREETMAP_TILE_URL)
  })

  it('falls back when unset', () => {
    expect(resolveLeafletTileUrl('')).toBe(OPENSTREETMAP_TILE_URL)
    expect(atlasLeafletTileUrl(undefined)).toBe(OPENSTREETMAP_TILE_URL)
  })

  it('locks latitude at world zoom and opens vertical pan when zoomed in', () => {
    const world = atlasMaxBounds(2, 2)
    expect(world[0][0]).toBeCloseTo(ATLAS_WORLD_LAT - 0.02)
    expect(world[1][0]).toBeCloseTo(ATLAS_WORLD_LAT + 0.02)
    const zoomed = atlasMaxBounds(4, 2)
    expect(zoomed[0][0]).toBe(-85)
    expect(zoomed[1][0]).toBe(85)
  })

  it('paints unvisited land as solid fills without a raster basemap', () => {
    expect(atlasUnvisitedLandFill(true).fillColor).toBe('#ffffff')
    expect(atlasUnvisitedLandFill(true).fillOpacity).toBeGreaterThan(0.8)
    expect(atlasUnvisitedLandFill(false).fillColor).toBe('#f8fafc')
    expect(atlasUnvisitedLandFill(false).fillOpacity).toBeGreaterThan(0.8)
  })

  it('chooses a world zoom that fills typical desktop widths', () => {
    expect(atlasWorldZoom(0)).toBe(2)
    expect(atlasWorldZoom(1024)).toBe(2)
    expect(atlasWorldZoom(1600)).toBeGreaterThan(2)
    expect(atlasWorldZoom(4000)).toBe(3)
  })
})
