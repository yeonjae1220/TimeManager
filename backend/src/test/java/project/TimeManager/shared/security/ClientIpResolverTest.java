package project.TimeManager.shared.security;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("ClientIpResolver")
class ClientIpResolverTest {

    @Mock private HttpServletRequest request;

    private final ClientIpResolver resolver = new ClientIpResolver("10.0.0.1");

    @Test
    @DisplayName("신뢰되지 않은 피어가 보낸 X-Forwarded-For는 무시하고 실제 TCP 피어 주소를 사용한다")
    void untrustedPeer_ignoresForwardedHeader() {
        when(request.getRemoteAddr()).thenReturn("203.0.113.9");

        assertThat(resolver.resolve(request)).isEqualTo("203.0.113.9");
    }

    @Test
    @DisplayName("신뢰 프록시에서 온 요청은 X-Forwarded-For 체인에서 신뢰되지 않는 마지막 IP를 사용한다")
    void trustedProxy_resolvesRightmostUntrustedIpFromChain() {
        when(request.getRemoteAddr()).thenReturn("10.0.0.1");
        when(request.getHeader("X-Forwarded-For")).thenReturn("198.51.100.7, 10.0.0.1");

        assertThat(resolver.resolve(request)).isEqualTo("198.51.100.7");
    }

    @Test
    @DisplayName("X-Forwarded-For가 없으면 신뢰 프록시에서 온 요청도 remoteAddr을 사용한다")
    void trustedProxy_withoutForwardedHeader_usesRemoteAddr() {
        when(request.getRemoteAddr()).thenReturn("10.0.0.1");
        when(request.getHeader("X-Forwarded-For")).thenReturn(null);

        assertThat(resolver.resolve(request)).isEqualTo("10.0.0.1");
    }
}
