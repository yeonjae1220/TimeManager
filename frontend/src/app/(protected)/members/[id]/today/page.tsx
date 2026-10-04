'use client'

import { useParams } from 'next/navigation'
import TodayView from '@/views/TodayView'

export default function Page() {
  const params = useParams()
  return <TodayView memberId={Number(params?.id)} />
}
