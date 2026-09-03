import { describe, expect, it } from 'vitest'
import apiClient from './apiClient'

describe('apiClient — 요청 타임아웃', () => {
  // 응답이 오지 않는 요청(네트워크 hang)이 useAsyncData의 fail()을 영영 못 부르고
  // 스피너가 영원히 도는 화면이 되는 것을 막는다(자세한 이유는 apiClient.ts 주석 참조).
  // 실제 hang을 흉내 내려면 이 저장소에 없는 HTTP mocking 라이브러리가 필요하므로,
  // 여기서는 axios 인스턴스에 timeout이 설정돼 있다는 사실 자체를 검증한다.
  it('timeout이 설정돼 있다', () => {
    expect(apiClient.defaults.timeout).toBeGreaterThan(0)
  })
})
