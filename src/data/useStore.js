import { useSyncExternalStore } from 'react'
import { subscribe, getSnapshot } from './store.js'

// Re-renders any component when the store mutates. Returns the whole state;
// components pull what they need from it (small app, cheap).
export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot)
}
