import type { Tag } from '@/store/tagStore'

/** 트리에서 id로 노드를 찾는다. TagListView·TagPickerModal 이 각자 만들어 쓰던 걸 통합. */
export function findTagNode(nodes: Tag[], id: number): Tag | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findTagNode(n.children, id)
    if (found) return found
  }
  return null
}

/** tagId의 부모 id. 못 찾으면(루트이거나 트리에 없으면) null. */
export function getParentId(tagTree: Tag[], tagId: number): number | null {
  const search = (nodes: Tag[], parent: Tag | null): number | null => {
    for (const n of nodes) {
      if (n.id === tagId) return parent?.id ?? null
      const found = search(n.children, n)
      if (found !== undefined && found !== null) return found
      if (n.children.some((c) => c.id === tagId)) return n.id
    }
    return null
  }
  return search(tagTree, null)
}

/** parentId 아래 형제 태그 이름들(소문자, DISCARDED 제외). 중복 이름 검사용. */
export function getSiblingNames(tagTree: Tag[], parentId: number | null, excludeId?: number): string[] {
  const search = (nodes: Tag[]): string[] => {
    for (const n of nodes) {
      if (n.id === parentId) {
        return n.children
          .filter((c) => c.type !== 'DISCARDED' && c.id !== excludeId)
          .map((c) => c.name.toLowerCase())
      }
      const found = search(n.children)
      if (found.length > 0 || n.id === parentId) return found
    }
    return []
  }
  if (parentId === null) return []
  return search(tagTree)
}

/**
 * tagId 자신 + 모든 하위 태그의 id 집합.
 *
 * 예전엔 "이 카테고리에 속하는 기록"을 TagSummary.parentTagName(문자열)과
 * 선택한 태그의 이름을 비교해 판별했다 — 서로 다른 가지에 있는 동명 태그가
 * 있으면 엉뚱한 기록이 섞여 들어갔다(이름만 같으면 매칭됨). 트리를 실제로 타고
 * 내려가 id로 판별하면 이름 충돌과 무관하게 정확하다.
 */
export function collectDescendantIds(tagTree: Tag[], tagId: number): Set<number> {
  const root = findTagNode(tagTree, tagId)
  const ids = new Set<number>()
  if (!root) return ids
  const walk = (node: Tag) => {
    ids.add(node.id)
    node.children.forEach(walk)
  }
  walk(root)
  return ids
}
