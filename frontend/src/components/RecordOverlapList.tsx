'use client'
import { useI18n } from '@/i18n/I18nProvider'

export interface RecordConflict { recordId: number; tagName: string; startTime: string; endTime: string }
export default function RecordOverlapList({ records, timezone }: { records: RecordConflict[]; timezone?: string }) {
  const { t, language } = useI18n()
  return <div role="alert">
    <p>{t('record.replaceWarning')}</p>
    <ul>{records.map((r) => <li key={r.recordId}>{r.tagName}: {new Date(r.startTime).toLocaleString(language, { timeZone: timezone })} → {new Date(r.endTime).toLocaleString(language, { timeZone: timezone })}</li>)}</ul>
  </div>
}
