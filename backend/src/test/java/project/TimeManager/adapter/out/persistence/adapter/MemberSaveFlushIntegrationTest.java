package project.TimeManager.adapter.out.persistence.adapter;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import project.TimeManager.application.service.notification.PushSender;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.member.model.OAuthProvider;
import project.TimeManager.domain.port.out.member.SaveMemberPort;

import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 가입 저장은 그 자리에서 INSERT 까지 내려가야 한다. 커밋 시점으로 미뤄지면 동시 가입의 유니크 위반이
 * 세션(Redis) 저장 뒤에야 터져, 롤백된 회원의 세션이 남는다(GoogleSessionIssuer·AppleSessionIssuer 순서).
 */
@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class MemberSaveFlushIntegrationTest {

    @MockBean PushSender pushSender;

    @Autowired SaveMemberPort saveMemberPort;
    @Autowired PlatformTransactionManager transactionManager;

    @Test
    @DisplayName("같은 이메일의 두 번째 저장은 커밋이 아니라 saveMember 호출에서 바로 실패한다")
    void duplicateFailsAtSaveNotAtCommit() {
        String email = "flush-check@example.test";
        new TransactionTemplate(transactionManager).executeWithoutResult(s ->
                saveMemberPort.saveMember(Member.registerWithOAuth("a", email, OAuthProvider.GOOGLE, "g-1")));

        AtomicBoolean failedInsideSave = new AtomicBoolean(false);
        try {
            new TransactionTemplate(transactionManager).executeWithoutResult(s -> {
                try {
                    saveMemberPort.saveMember(Member.registerWithOAuth("b", email, OAuthProvider.APPLE, "a-1"));
                } catch (DataIntegrityViolationException e) {
                    failedInsideSave.set(true);
                    throw e;
                }
            });
        } catch (DataIntegrityViolationException expectedAtCommitOrSave) {
            // 커밋에서 터졌다면 failedInsideSave 가 false 로 남는다.
        }

        assertThat(failedInsideSave).as("유니크 위반이 saveMember 안에서 나야 한다").isTrue();
    }
}
