'use client'
import { create } from 'zustand'
import type { NativeRunningSession } from '@/native/runningSession'

/** The running session is independent of the tag currently being inspected. */
export const useRunningTimerStore = create<{
  session: NativeRunningSession | null
  busy: boolean
  revision: number
  memberId: number | null
  error: boolean
}>(() => ({ session: null, busy: false, revision: 0, memberId: null, error: false }))
