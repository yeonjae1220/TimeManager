package project.TimeManager.application.service.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

class AdminServiceDeleteTxTest {

    @Test
    @DisplayName("관리자 삭제는 클래스 트랜잭션 밖에서 돈다 — Apple 철회(HTTP)가 롤백될 수 있는 트랜잭션 안에서 나가지 않게")
    void deleteMemberRunsOutsideTransaction() throws NoSuchMethodException {
        Transactional tx = AdminService.class.getMethod("deleteMember", Long.class).getAnnotation(Transactional.class);

        assertThat(tx).isNotNull();
        assertThat(tx.propagation()).isEqualTo(Propagation.NOT_SUPPORTED);
    }
}
