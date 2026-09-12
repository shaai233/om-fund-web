import { beforeEach, describe, expect, it, vi } from 'vitest'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length () { return this.data.size }
  clear () { this.data.clear() }
  getItem (key: string) { return this.data.get(key) ?? null }
  key (index: number) { return Array.from(this.data.keys())[index] ?? null }
  removeItem (key: string) { this.data.delete(key) }
  setItem (key: string, value: string) { this.data.set(key, value) }
}

describe('watchlist store', function () {
  beforeEach(function () {
    vi.resetModules()
    vi.stubGlobal('localStorage', new MemoryStorage())
  })

  it('creates groups and moves codes between them', async function () {
    const { default: useWatchlistStore, DEFAULT_GROUP } = await import('@/stores/watchlist')
    const store = useWatchlistStore()

    store.add('161725')
    store.createGroup('长期')
    store.move('161725', DEFAULT_GROUP, '长期')

    expect(store.state.groups[DEFAULT_GROUP]).toEqual([])
    expect(store.state.groups['长期']).toEqual(['161725'])
  })

  it('moves codes back to the default group when deleting a group', async function () {
    const { default: useWatchlistStore, DEFAULT_GROUP } = await import('@/stores/watchlist')
    const store = useWatchlistStore()

    store.createGroup('观察')
    store.add('000300', '观察')
    store.deleteGroup('观察')

    expect(store.state.groups['观察']).toBeUndefined()
    expect(store.state.groups[DEFAULT_GROUP]).toEqual(['000300'])
  })

  it('reorders codes without losing items', async function () {
    const { default: useWatchlistStore } = await import('@/stores/watchlist')
    const store = useWatchlistStore()

    store.add('000001')
    store.add('000002')
    store.add('000003')
    store.reorder('默认', 2, 0)

    expect(store.state.groups['默认']).toEqual(['000003', '000001', '000002'])
  })
})
