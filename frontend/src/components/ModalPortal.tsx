'use client'

import { createPortal } from 'react-dom'

/** Keep fixed overlays outside the scroll container's stacking/clipping context. */
export default function ModalPortal({ children }: { children: React.ReactNode }) {
  return typeof document === 'undefined' ? null : createPortal(children, document.body)
}
