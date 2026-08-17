package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.domain.port.in.member.DeleteMemberUseCase;
import project.TimeManager.domain.port.out.auth.TokenStorePort;
import project.TimeManager.domain.port.out.member.DeleteMemberPort;
import project.TimeManager.domain.port.out.notification.SavePushSubscriptionPort;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class DeleteMemberCommandService implements DeleteMemberUseCase {

    private final DeleteMemberPort deleteMemberPort;
    private final SavePushSubscriptionPort savePushSubscriptionPort;
    private final TokenStorePort tokenStorePort;

    /**
     * 계정을 '삭제 상태'로 둔다. 데이터는 유예 기간 동안 남아 있다가
     * PurgeDeletedMembersCommandService 가 물리적으로 지운다.
     *
     * 삭제된 회원은 MemberPersistenceAdapter 의 모든 조회에서 빠지므로 로그인·토큰
     * 재발급·관리자 목록·배치가 한 번에 막힌다. 태그·기록에는 따로 표시하지 않는다 —
     * 회원을 통해서만 도달할 수 있는 데이터라 관문 하나로 충분하고, 모든 태그·기록
     * 쿼리에 필터를 흩뿌리면 한 곳만 빠뜨려도 삭제된 데이터가 새어 나온다.
     *
     * ⚠️ 이미 발급된 액세스 토큰은 만료(15분)까지 유효하다. JwtAuthenticationFilter 가
     * DB 를 조회하지 않기 때문인데, 매 요청마다 회원을 읽는 비용을 지불하지 않기 위한
     * 의도적 선택이다. 본인 토큰으로 본인 데이터에만 접근하는 창이고, 클라이언트는
     * 삭제 직후 로그아웃한다. 새 토큰 발급은 아래 세션 무효화와 refresh 의 회원 조회로 막힌다.
     */
    @Override
    public void deleteMember(Long memberId) {
        // 존재하지 않거나 이미 삭제된 계정에 예외를 던지지 않는다 — 클라이언트가
        // 재시도하거나 두 기기에서 동시에 눌러도 실패로 보이면 안 된다.
        if (!deleteMemberPort.softDeleteMember(memberId)) {
            log.info("deleteMember: already deleted or missing, skipping. memberId={}", memberId);
            return;
        }
        savePushSubscriptionPort.deleteByMemberId(memberId);

        // 세션 무효화는 정리 단계다. Redis 가 죽었다고 탈퇴가 실패하면 사용자는
        // 자기 계정을 지울 수 없게 되는데, 그건 이 실패가 초래할 결과보다 훨씬 나쁘다.
        // 남은 세션은 refresh 가 삭제된 회원을 못 찾아 어차피 거부한다.
        try {
            int revoked = tokenStorePort.deleteByMemberId(memberId);
            log.info("deleteMember: soft-deleted memberId={}, revoked {} session(s)", memberId, revoked);
        } catch (Exception e) {
            log.warn("deleteMember: soft-deleted memberId={} but session revocation failed "
                    + "(refresh 가 삭제된 회원을 거부하므로 세션은 무력하다)", memberId, e);
        }
    }
}
