import { describe, expect, it } from 'vitest'
import { collectDescendantIds, findTagNode, getParentId, getSiblingNames } from './tagTree'
import type { Tag } from '@/store/tagStore'

function makeTag(id: number, name: string, children: Tag[] = [], type: Tag['type'] = 'CUSTOM' as Tag['type']): Tag {
  return {
    id,
    name,
    type,
    state: false,
    elapsedTime: 0,
    latestStopTimeMs: null,
    children,
  }
}

// 개발 / 업무(공부, 코딩) 라는 트리와, 별개 가지에 동명 "공부"를 하나 더 둔다.
// filterForTag 가 이름으로 매칭하던 시절엔 "업무 > 공부"를 골랐을 때
// "여가 > 공부"의 기록까지 섞여 들어갔다.
const workStudy = makeTag(3, '공부')
const workCoding = makeTag(4, '코딩')
const work = makeTag(2, '업무', [workStudy, workCoding])
const leisureStudy = makeTag(6, '공부')
const leisure = makeTag(5, '여가', [leisureStudy])
const tagTree: Tag[] = [makeTag(1, 'ROOT', [work, leisure], 'ROOT')]

describe('collectDescendantIds', () => {
  it('선택한 태그 자신 + 하위 태그 id만 모은다', () => {
    expect(collectDescendantIds(tagTree, work.id)).toEqual(new Set([2, 3, 4]))
  })

  it('[회귀] 동명이지만 다른 가지에 있는 태그는 섞이지 않는다', () => {
    const ids = collectDescendantIds(tagTree, work.id)
    expect(ids.has(leisureStudy.id)).toBe(false)
  })

  it('리프 태그는 자기 자신 id 하나만 반환한다', () => {
    expect(collectDescendantIds(tagTree, workStudy.id)).toEqual(new Set([3]))
  })

  it('트리에 없는 id면 빈 집합을 반환한다', () => {
    expect(collectDescendantIds(tagTree, 999)).toEqual(new Set())
  })
})

describe('getParentId / findTagNode / getSiblingNames', () => {
  it('findTagNode는 중첩된 자식도 찾는다', () => {
    expect(findTagNode(tagTree, workCoding.id)?.name).toBe('코딩')
  })

  it('getParentId는 직계 부모 id를 반환한다', () => {
    expect(getParentId(tagTree, workStudy.id)).toBe(work.id)
  })

  it('getSiblingNames는 excludeId를 빼고 소문자로 반환한다', () => {
    expect(getSiblingNames(tagTree, work.id, workStudy.id)).toEqual(['코딩'])
  })

  it('parentId가 null이면 빈 배열', () => {
    expect(getSiblingNames(tagTree, null)).toEqual([])
  })
})
