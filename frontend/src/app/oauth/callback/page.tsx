'use client'

import { Suspense } from 'react'
import OAuthCallbackView from '@/views/OAuthCallbackView'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OAuthCallbackView />
    </Suspense>
  )
}
