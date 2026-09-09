'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import TagPickerModal from '@/components/TagPickerModal'
import { useTagStore } from '@/store/tagStore'
import { collectDescendantIds } from '@/utils/tagTree'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useI18n } from '@/i18n/I18nProvider'
import { type TagSummary, type SummaryData, fmtHMS, toLocalDate, startOfWeek, addDays, getPrevRange, startOfMonth, endOfMonth, TagBar, LoadError, getSummary } from './shared'

// ────────────────────────────────────────────────────────────
// Tag tab
// ────────────────────────────────────────────────────────────

type TagPeriod = 'week' | 'month' | 'custom'

export default function TagTab({ memberId }: { memberId: number }) {
  const { t: tr } = useI18n()
  const tagTree = useTagStore((s) => s.tagTree)
  const loadTags = useTagStore((s) => s.loadTags)
  const findById = useTagStore((s) => s.findById)

  const [showPicker, setShowPicker] = useState(false)
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null)
  const [period, setPeriod] = useState<TagPeriod>('week')
  const [customStart, setCustomStart] = useState(() => toLocalDate(addDays(new Date(), -6)))
  const [customEnd, setCustomEnd] = useState(() => toLocalDate(new Date()))

  useEffect(() => { if (memberId) loadTags(memberId) }, [memberId, loadTags])

  const getRange = useCallback((): [Date, Date] => {
    const today = new Date()
    if (period === 'week') return [startOfWeek(today), addDays(startOfWeek(today), 6)]
    if (period === 'month') return [startOfMonth(today), endOfMonth(today)]
    return [new Date(customStart), new Date(customEnd)]
  }, [period, customStart, customEnd])

  // 실제 입력은 getRange 가 담은 기간 세 값뿐이다 — 조회 자체는 항상 전체 태그를
  // 가져오고, selectedTagId 는 filterForTag 에서 클라이언트 사이드로만 골라낸다.
  // 그래서 태그를 바꿔도 재조회가 필요 없다(스피너 없이 즉시 필터링).
  const loadRanges = useCallback(() => {
    const [start, end] = getRange()
    const [pStart, pEnd] = getPrevRange(start, end)
    return Promise.all([getSummary(start, end), getSummary(pStart, pEnd)])
      .then(([cur, pr]) => ({ current: cur, prev: pr }))
  }, [getRange])

  // 태그 미선택 시에도 조회한다 — 예전엔 여기서 loader 를 null 로 넘겨 태그를
  // 고르기 전까지 빈 화면만 보여줬다. "전체 태그" 기본 데이터를 먼저 보여주는
  // 편이 더 유용하다.
  const { data: ranges, loading, failed, reload } = useAsyncData(loadRanges)
  const current = ranges?.current ?? null
  const prev = ranges?.prev ?? null

  const selectedTag = selectedTagId ? findById(selectedTagId) : null

  // 태그 미선택("전체 태그") 시엔 필터링 없이 전체를 쓴다. 선택했으면 그 태그
  // 자신 + 하위 태그의 id 집합으로 거른다.
  //
  // 예전엔 TagSummary.parentTagName(문자열)과 선택한 태그의 이름을 비교했다 —
  // 서로 다른 가지에 동명 태그가 있으면 엉뚱한 기록이 섞여 들어가는 결함이었다.
  // 트리를 id로 타고 내려가면 이름 충돌과 무관하게 정확하다.
  const descendantIds = useMemo(
    () => (selectedTagId ? collectDescendantIds(tagTree, selectedTagId) : null),
    [tagTree, selectedTagId],
  )

  function filterForTag(data: SummaryData): TagSummary[] {
    if (!descendantIds) return data.tagSummaries
    return data.tagSummaries.filter((t) => descendantIds.has(t.tagId))
  }

  const currentFiltered = current ? filterForTag(current) : []
  const prevFiltered = prev ? filterForTag(prev) : []
  const currentTotal = currentFiltered.reduce((s, t) => s + t.totalSeconds, 0)
  const prevTotal = prevFiltered.reduce((s, t) => s + t.totalSeconds, 0)
  const delta = prevTotal > 0 ? Math.round(((currentTotal - prevTotal) / prevTotal) * 100) : null

  return (
    <div>
      {/* Tag selector */}
      <button
        onClick={() => setShowPicker(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', color: 'var(--text)', marginBottom: 20 }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-3)', flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: 'left', fontSize: 13 }}>{selectedTag?.name ?? tr('logs.allTags')}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {(['week', 'month', 'custom'] as TagPeriod[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className="mono"
            style={{ padding: '5px 12px', background: period === p ? 'var(--accent)' : 'var(--surface-2)', border: `1px solid ${period === p ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', color: period === p ? 'var(--bg)' : 'var(--text-2)', fontSize: 10, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            {p === 'week' ? tr('logs.periodWeek') : p === 'month' ? tr('logs.periodMonth') : tr('logs.periodCustom')}
          </button>
        ))}
      </div>
      {period === 'custom' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ flex: 1, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 10px', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>~</span>
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ flex: 1, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 10px', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
        </div>
      )}

      {loading && <div className="spinner" style={{ margin: '40px auto' }} />}
      {!loading && failed && <LoadError onRetry={reload} />}
      {/* !failed 가 필수다. 빼면 조회 실패가 "해당 기간에 기록이 없습니다" + 기록
          시작 CTA 로 보인다 — 침묵이 아니라 틀린 사실을 단언하는 화면이라 사용자가
          "이 기간엔 안 했구나"로 확신하고 넘어간다. 아래 통계 블록은 지금은
          length > 0 게이트에 막히지만, 게이트가 바뀌어도 실패 시엔 안 나오도록
          여기서도 !failed 를 건다. */}
      {!loading && !failed && currentFiltered.length === 0 && (
        <div style={{ display: 'grid', justifyItems: 'center', gap: 12, marginTop: 40 }}>
          <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>{tr('logs.noRecordsPeriod')}</p>
          <Link href={`/members/${memberId}/today${selectedTagId ? `?tagId=${selectedTagId}` : ''}`} className="mono" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 40, padding: '0 14px', background: 'var(--accent)', borderRadius: 'var(--radius)', color: 'var(--bg)', fontSize: 11 }}>
            {tr('logs.startToday')}
          </Link>
        </div>
      )}

      {!loading && !failed && currentFiltered.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <div style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', padding: '14px 16px', textAlign: 'center' }}>
              <p className="mono" style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em', marginBottom: 6 }}>{tr('logs.tagTotal')}</p>
              <p className="mono" style={{ fontSize: 16 }}>{fmtHMS(currentTotal)}</p>
            </div>
            <div style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', padding: '14px 16px', textAlign: 'center' }}>
              <p className="mono" style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em', marginBottom: 6 }}>{tr('logs.vsPrev')}</p>
              <p className="mono" style={{ fontSize: 16, color: delta === null ? 'var(--text-3)' : delta >= 0 ? 'var(--running)' : 'var(--danger)' }}>
                {delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta}%`}
              </p>
            </div>
          </div>
          {currentFiltered.map((t) => (
            <TagBar key={t.tagId} summary={t} total={currentTotal} />
          ))}
        </>
      )}

      {showPicker && (
        <TagPickerModal
          tagTree={tagTree}
          currentTagId={selectedTagId}
          onSelect={(id) => { setSelectedTagId(id); setShowPicker(false) }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

