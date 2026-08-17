import type { Metadata } from 'next'
import Link from 'next/link'

/**
 * 개인정보처리방침.
 *
 * (protected) 바깥에 둔다 — App Store Connect·Play Console 에 등록하는 URL 은
 * 로그인 없이 열려야 하고, 심사관도 계정 없이 확인한다.
 *
 * 앱 i18n(9개 언어)을 쓰지 않고 영문·국문 병기 정적 문서로 둔다. 법적 고지를
 * 기계 번역으로 9개 언어에 복제하면 언어마다 다른 약속을 하게 되고, 문구를 고칠 때
 * 9곳이 어긋난다. 내용은 반드시 실제 구현과 일치해야 한다 — 특히 계정 삭제
 * 동작(DeleteMemberCommandService)을 바꾸면 이 문서도 함께 고칠 것.
 */

const LAST_UPDATED = '2026-08-17'
const CONTACT_EMAIL = 'duswokim1220@gmail.com'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How TimeManager collects, uses, and deletes your data.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>{title}</h2>
      <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-2)' }}>{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '40px 20px 80px' }}>
      <Link href="/" className="mono" style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.18em', textTransform: 'uppercase', textDecoration: 'none' }}>
        timemgr
      </Link>

      <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: '24px 0 6px' }}>
        Privacy Policy · 개인정보처리방침
      </h1>
      <p className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
        Last updated · 최종 개정 {LAST_UPDATED}
      </p>

      <Section title="1. What we collect · 수집 항목">
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          <li>Account: email address, display name, and — if you sign in with Google — the
            provider&apos;s stable user identifier (<code>sub</code>).<br />
            <span lang="ko">계정: 이메일 주소, 표시 이름, Google 로그인 시 제공자의 고유 식별자(<code>sub</code>).</span>
          </li>
          <li>Usage data you create: tags, timer sessions, and time records.<br />
            <span lang="ko">사용자가 만든 데이터: 태그, 타이머 세션, 시간 기록.</span>
          </li>
          <li>Technical: IP address, kept transiently for rate limiting and abuse prevention.<br />
            <span lang="ko">기술 정보: 요청 속도 제한과 남용 방지를 위해 일시적으로 보관하는 IP 주소.</span>
          </li>
        </ul>
        <p style={{ marginTop: 10 }}>
          We do not collect location, contacts, photos, or device identifiers for advertising.<br />
          <span lang="ko">위치·연락처·사진, 광고용 기기 식별자는 수집하지 않습니다.</span>
        </p>
      </Section>

      <Section title="2. How we use it · 이용 목적">
        <p>
          Solely to operate the service: authenticating you, storing and displaying your own time
          records, and keeping the service available. We do not profile you and we do not use your
          data to train models.<br />
          <span lang="ko">서비스 운영에만 사용합니다 — 로그인 인증, 본인의 시간 기록 저장·표시, 서비스 유지.
          프로파일링을 하지 않으며 모델 학습에 사용하지 않습니다.</span>
        </p>
      </Section>

      <Section title="3. Notifications · 알림">
        <p>
          The mobile app schedules reminders <strong>on your device</strong> (daily-goal and
          long-running-timer reminders). Nothing about your timers is sent to a push service for
          this. Notifications are off until you grant permission, and you can revoke it at any time
          in your system settings.<br />
          <span lang="ko">모바일 앱의 알림(목표 도달·장시간 실행 리마인더)은 <strong>기기 안에서</strong> 예약됩니다.
          이를 위해 타이머 정보를 푸시 서비스로 보내지 않습니다. 권한을 허용하기 전에는 알림이 오지 않으며,
          시스템 설정에서 언제든 취소할 수 있습니다.</span>
        </p>
      </Section>

      <Section title="4. Sharing · 제3자 제공">
        <p>
          We do not sell or share your data. The only third party involved is Google, and only when
          you choose to sign in with a Google account — we receive your email, name, and identifier
          from them. There are no advertising or analytics trackers in this app.<br />
          <span lang="ko">데이터를 판매하거나 공유하지 않습니다. 관여하는 제3자는 Google 로그인을 선택했을 때의
          Google 뿐이며, 이메일·이름·식별자를 제공받습니다. 광고·분석 추적기는 사용하지 않습니다.</span>
        </p>
      </Section>

      <Section title="5. Retention and deletion · 보관 기간과 삭제">
        <p>
          Your data is kept while your account exists. You can delete your account at any time from
          Profile → Delete account; doing so removes your account together with the tags, records,
          and notification subscriptions attached to it. Deletion is immediate and cannot be undone
          — export anything you want to keep first.<br />
          <span lang="ko">계정이 존재하는 동안 데이터를 보관합니다. 프로필 → 계정 삭제에서 언제든 삭제할 수 있으며,
          계정과 함께 그 계정에 속한 태그·기록·알림 구독 정보가 제거됩니다. 삭제는 즉시 적용되고 되돌릴 수 없습니다.</span>
        </p>
        <p style={{ marginTop: 10 }}>
          IP addresses used for rate limiting are not stored in the database and expire with the
          rate-limit window.<br />
          <span lang="ko">속도 제한에 쓰이는 IP 주소는 데이터베이스에 저장되지 않고 제한 시간 창과 함께 만료됩니다.</span>
        </p>
      </Section>

      <Section title="6. Security · 보안">
        <p>
          Traffic is served over HTTPS. Passwords are stored as salted hashes, never in plain text.
          Session tokens are held in HttpOnly cookies so page scripts cannot read them.<br />
          <span lang="ko">모든 통신은 HTTPS 로 이루어집니다. 비밀번호는 솔트를 적용한 해시로만 저장하며 평문으로
          저장하지 않습니다. 세션 토큰은 HttpOnly 쿠키에 담겨 페이지 스크립트가 읽을 수 없습니다.</span>
        </p>
      </Section>

      <Section title="7. Children · 아동">
        <p>
          The service is not directed at children under 13, and we do not knowingly collect their
          data.<br />
          <span lang="ko">만 13세 미만 아동을 대상으로 하지 않으며, 해당 연령의 개인정보를 알면서 수집하지 않습니다.</span>
        </p>
      </Section>

      <Section title="8. Contact · 문의">
        <p>
          Questions or deletion requests: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent)' }}>{CONTACT_EMAIL}</a>
          <br />
          <span lang="ko">문의 및 삭제 요청: 위 이메일로 연락해 주세요.</span>
        </p>
      </Section>
    </main>
  )
}
