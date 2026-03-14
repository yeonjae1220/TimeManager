package project.TimeManager.adapter.in.web.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import project.TimeManager.domain.member.model.MemberId;

import java.io.IOException;
import java.util.Collections;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String requestId = resolveRequestId(request);
        MDC.put("requestId", requestId);
        response.setHeader("X-Request-ID", requestId);

        try {
            String token = resolveToken(request);

            if (StringUtils.hasText(token) && jwtTokenProvider.validateAccessToken(token)) {
                MemberId memberId = jwtTokenProvider.extractMemberId(token);
                MDC.put("memberId", memberId.value().toString());
                UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                        memberId.value(), null, Collections.emptyList());
                SecurityContextHolder.getContext().setAuthentication(auth);
            }

            filterChain.doFilter(request, response);
        } finally {
            MDC.clear();
        }
    }

    private String resolveRequestId(HttpServletRequest request) {
        String existing = request.getHeader("X-Request-ID");
        return StringUtils.hasText(existing) ? existing : UUID.randomUUID().toString().substring(0, 8);
    }

    private String resolveToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
