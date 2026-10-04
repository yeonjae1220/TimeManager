import { describe, expect, it } from 'vitest'
import manifest from './manifest'

describe('PWA manifest', () => {
  it('홈 화면 앱은 랜딩을 거치지 않고 타이머 화면(/today)으로 바로 연다', () => {
    // 랜딩(/)에서 /members/{id}/today 로 다시 이동하면 서버 왕복이 한 번 더 붙어
    // 콜드 스타트마다 스켈레톤이 그만큼 길어진다.
    expect(manifest().start_url).toBe('/today')
  })

  it('[회귀] 시작 주소를 바꿔도 앱 정체성(id)은 예전 값 "/" 를 유지한다', () => {
    // id 가 없으면 start_url 이 곧 id 다. start_url 만 바꾸면 이미 설치된 앱(Android·데스크톱
    // Chrome)이 다른 앱으로 취급돼 매니페스트 갱신을 받지 못한다.
    expect(manifest().id).toBe('/')
  })
})
