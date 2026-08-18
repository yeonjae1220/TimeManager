import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { TIMER_NOTIFICATION_PLUGIN } from './timerNotification'
import { findRepoRoot, readRepoFile } from '@/test-utils/repoRoot'
import { messages } from '@/i18n/messages'

/**
 * TS 와 네이티브가 **같은 값을 각자 적어둔** 지점들. 한쪽만 바뀌어도 빌드·타입체크·
 * 기존 테스트가 전부 통과하고, 어긋났다는 사실 자체를 아무도 모른다.
 *
 * 특히 플러그인 이름은 단위 테스트가 원리적으로 못 잡는다 — 테스트가 `registerPlugin` 을
 * 목으로 갈아끼워 이름을 무시하고, capability 목록도 같은 TS 상수를 쓰기 때문이다.
 * 상수만 바꾸면 초록인 채로 배포되고 실기에서만 "not implemented" 가 난다.
 */

const PLUGIN_JAVA = 'frontend/android/app/src/main/java/com/mungji/timemanager/TimerNotificationPlugin.java'
const RES_DIR = 'frontend/android/app/src/main/res'

describe('네이티브 계약', () => {
  it('플러그인 이름이 TS 상수와 Java 애너테이션에서 같다', () => {
    const java = readRepoFile(PLUGIN_JAVA)
    const match = java.match(/@CapacitorPlugin\(\s*name\s*=\s*"([^"]+)"/)

    expect(match, `${PLUGIN_JAVA} 에서 @CapacitorPlugin(name = ...) 을 찾지 못했습니다`).not.toBeNull()
    expect(match![1]).toBe(TIMER_NOTIFICATION_PLUGIN)
  })

  it('실행중 알림 id 가 리마인더 알림 id 와 겹치지 않는다', () => {
    const java = readRepoFile(PLUGIN_JAVA)
    const idMatch = java.match(/NOTIFICATION_ID\s*=\s*(\d+)/)
    expect(idMatch, 'Java 에서 NOTIFICATION_ID 를 찾지 못했습니다').not.toBeNull()
    const ongoingId = Number(idMatch![1])

    // 리마인더 id 는 runningSession.ts 안에서만 쓰이는 모듈 상수라, 내보내는 대신 소스에서 읽는다.
    const ts = readRepoFile('frontend/src/native/runningSession.ts')
    const reminderIds = [...ts.matchAll(/\bid:\s*(\d{4,})|NOTIFICATION_ID\s*=\s*(\d{4,})/g)]
      .map((m) => Number(m[1] ?? m[2]))

    expect(reminderIds.length, 'runningSession.ts 에서 리마인더 id 를 하나도 못 찾았습니다').toBeGreaterThan(0)
    expect(reminderIds).not.toContain(ongoingId)
  })

  /**
   * 알림 채널 이름은 **시스템 설정 언어**를 따르므로 웹 i18n 과 별도 리소스가 필요하다.
   * 웹에 10번째 언어가 추가되면 그 언어 사용자만 채널 이름이 조용히 영어로 남는다.
   */
  describe('알림 채널 문구가 웹 i18n 과 같은 언어를 덮는다', () => {
    const locales = Object.keys(messages)

    it('웹 로케일이 9개다 (늘어나면 아래 대조도 함께 늘어난다)', () => {
      expect(locales.length).toBe(9)
    })

    it.each(locales)('%s 에 채널 이름·설명이 있다', (locale) => {
      // en 은 기본 리소스(values/), 나머지는 values-<locale>/ 에 들어간다.
      const dir = locale === 'en' ? 'values' : `values-${locale}`
      const xml = readRepoFile(`${RES_DIR}/${dir}/strings.xml`)

      expect(xml, `${dir}: timer_ongoing_channel_name 이 없습니다`).toContain('timer_ongoing_channel_name')
      expect(xml, `${dir}: timer_ongoing_channel_description 이 없습니다`).toContain('timer_ongoing_channel_description')
    })

    it('웹에 없는 언어 리소스를 만들지 않는다 — 유지보수 대상만 늘어난다', () => {
      const dirs = readdirSync(resolve(findRepoRoot(), RES_DIR), { withFileTypes: true })
        .filter((e) => e.isDirectory() && /^values-[a-z]{2}$/.test(e.name))
        .map((e) => e.name.replace('values-', ''))

      expect(dirs.sort()).toEqual(locales.filter((l) => l !== 'en').sort())
    })
  })
})
