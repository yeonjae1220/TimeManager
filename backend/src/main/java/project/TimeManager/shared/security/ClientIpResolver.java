package project.TimeManager.shared.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

/**
 * 신뢰 프록시(nginx-ingress 등) IP/CIDR 대역에서 온 요청만 X-Forwarded-For 헤더를 신뢰해
 * 실제 클라이언트 IP를 추출한다.
 * 그렇지 않으면 클라이언트가 헤더를 위조해 IP 기반 rate limit을 우회할 수 있다.
 * (AuthApiController.getClientIp에 있던 로직을 register 엔드포인트에서도 재사용하도록 추출)
 */
@Component
public class ClientIpResolver {

    private final List<IpAddressMatcher> trustedProxyMatchers;

    public ClientIpResolver(@Value("${app.trusted-proxy-ips:127.0.0.1,::1}") String trustedProxyIpsConfig) {
        this.trustedProxyMatchers = Arrays.stream(trustedProxyIpsConfig.split(","))
                .map(String::trim)
                .filter(ip -> !ip.isEmpty())
                .map(this::parseMatcher)
                .toList();
    }

    private IpAddressMatcher parseMatcher(String ip) {
        try {
            return new IpAddressMatcher(ip);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("app.trusted-proxy-ips에 잘못된 IP/CIDR 항목이 있습니다: " + ip, e);
        }
    }

    public String resolve(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (isTrustedProxy(remoteAddr)) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                return resolveFromChain(forwarded);
            }
        }
        return remoteAddr;
    }

    /**
     * X-Forwarded-For는 각 홉이 자신을 덧붙이는 방식으로 누적될 수 있어(use-forwarded-headers: true 등),
     * 가장 왼쪽 값은 클라이언트가 임의로 주입할 수 있다.
     * 오른쪽부터 훑어 신뢰 프록시가 아닌 첫 항목을 실제 클라이언트 IP로 본다.
     */
    private String resolveFromChain(String forwarded) {
        String[] ips = forwarded.split(",");
        for (int i = ips.length - 1; i >= 0; i--) {
            String candidate = ips[i].trim();
            if (!candidate.isEmpty() && !isTrustedProxy(candidate)) {
                return candidate;
            }
        }
        return ips[0].trim();
    }

    private boolean isTrustedProxy(String remoteAddr) {
        return trustedProxyMatchers.stream().anyMatch(matcher -> matcher.matches(remoteAddr));
    }
}
