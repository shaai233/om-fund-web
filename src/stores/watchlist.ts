import { reactive } from 'vue'

interface PersistedWatchlist {
  version: number
  groups: Record<string, string[]>
}

const STORAGE_KEY = 'omfund.web.watchlist.v2'
const LEGACY_STORAGE_KEY = 'omfund.web.watchlist.v1'
export const DEFAULT_GROUP = '默认'

function loadGroups (): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return { [DEFAULT_GROUP]: [] }
    const parsed = JSON.parse(raw) as PersistedWatchlist
    if (![1, 2].includes(parsed.version) || !parsed.groups || typeof parsed.groups !== 'object') {
      return { [DEFAULT_GROUP]: [] }
    }
    return { ...parsed.groups, [DEFAULT_GROUP]: parsed.groups[DEFAULT_GROUP] ?? [] }
  } catch {
    return { [DEFAULT_GROUP]: [] }
  }
}

const state = reactive({ groups: loadGroups() })

function persist () {
  const payload: PersistedWatchlist = { version: 1, groups: state.groups }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

function orderedGroupNames (): string[] {
  return Object.keys(state.groups).sort(function (left, right) {
    if (left === DEFAULT_GROUP) return -1
    if (right === DEFAULT_GROUP) return 1
    return left.localeCompare(right, 'zh-CN')
  })
}

function allCodes (): string[] {
  return Array.from(new Set(Object.values(state.groups).flat()))
}

function createGroup (name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed || state.groups[trimmed]) return false
  state.groups[trimmed] = []
  persist()
  return true
}

function renameGroup (oldName: string, newName: string): boolean {
  const trimmed = newName.trim()
  if (oldName === DEFAULT_GROUP || !trimmed || trimmed === oldName || state.groups[trimmed]) return false
  const codes = state.groups[oldName]
  if (!codes) return false
  delete state.groups[oldName]
  state.groups[trimmed] = codes
  persist()
  return true
}

function deleteGroup (name: string): boolean {
  if (name === DEFAULT_GROUP || !state.groups[name]) return false
  const codes = state.groups[name]
  delete state.groups[name]
  codes.forEach(function (code) {
    add(code, DEFAULT_GROUP)
  })
  persist()
  return true
}

function add (code: string, group = DEFAULT_GROUP) {
  const target = state.groups[group] ?? (state.groups[group] = [])
  if (!target.includes(code)) {
    target.push(code)
    persist()
  }
}

function remove (code: string, group: string) {
  const target = state.groups[group]
  if (!target) return
  state.groups[group] = target.filter(function (item) { return item !== code })
  persist()
}

function move (code: string, from: string, to: string) {
  if (from === to) return
  remove(code, from)
  add(code, to)
}

function reorder (group: string, fromIndex: number, toIndex: number) {
  const target = state.groups[group]
  if (!target || fromIndex < 0 || toIndex < 0 || fromIndex >= target.length || toIndex >= target.length) return
  const next = [...target]
  const [item] = next.splice(fromIndex, 1)
  if (!item) return
  next.splice(toIndex, 0, item)
  state.groups[group] = next
  persist()
}

export default function useWatchlistStore () {
  return {
    state,
    orderedGroupNames,
    allCodes,
    createGroup,
    renameGroup,
    deleteGroup,
    add,
    remove,
    move,
    reorder
  }
}
