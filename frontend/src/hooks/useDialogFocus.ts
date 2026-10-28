'use client'
import { useEffect, useRef, type RefObject } from 'react'

/** Keep keyboard navigation inside the topmost modal and restore its trigger. */
export function useDialogFocus(ref: RefObject<HTMLDivElement | null>, onClose: () => void, busy: boolean) {
  const latest = useRef({ onClose, busy })
  useEffect(() => { latest.current = { onClose, busy } }, [onClose, busy])
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const previous = document.activeElement as HTMLElement | null
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]'))
      .filter((el) => !el.hidden)
    focusable()[0]?.focus()
    const onKey = (event: KeyboardEvent) => {
      const overlays = document.querySelectorAll('[data-modal-overlay]')
      if (dialog.closest('[data-modal-overlay]') !== overlays[overlays.length - 1]) return
      if (event.key === 'Escape' && !latest.current.busy) { event.preventDefault(); latest.current.onClose() }
      if (event.key !== 'Tab') return
      const elements = focusable(), first = elements[0], last = elements.at(-1)
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus() }
  }, [ref])
}
