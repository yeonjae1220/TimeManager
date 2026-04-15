package project.TimeManager.adapter.in.web.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.member.model.MemberRole;
import project.TimeManager.domain.port.out.auth.TokenGeneratorPort;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.UUID;

@Slf4j
@Component
public class JwtTokenProviderImpl implements JwtTokenProvider, TokenGeneratorPort {

    @Value("${jwt.secret}")
    private String secretValue;

    @Value("${jwt.access-token-ttl-minutes:15}")
    private long accessTokenTtlMinutes;

    private SecretKey signingKey;

    @PostConstruct
    public void init() {
        byte[] keyBytes = Decoders.BASE64.decode(secretValue);
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
    }

    @Override
    public String generateAccessToken(MemberId memberId, MemberRole role) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + accessTokenTtlMinutes * 60 * 1000L);

        return Jwts.builder()
                .claim("memberId", memberId.value())
                .claim("role", role != null ? role.name() : MemberRole.MEMBER.name())
                .issuedAt(now)
                .expiration(expiry)
                .signWith(getSigningKey())
                .compact();
    }

    @Override
    public String generateRefreshToken() {
        return UUID.randomUUID().toString();
    }

    @Override
    public MemberId extractMemberId(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
        Long memberId = claims.get("memberId", Long.class);
        return MemberId.of(memberId);
    }

    @Override
    public MemberRole extractRole(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            String role = claims.get("role", String.class);
            if (role == null) return MemberRole.MEMBER;
            return MemberRole.valueOf(role);
        } catch (Exception e) {
            return MemberRole.MEMBER;
        }
    }

    @Override
    public boolean validateAccessToken(String token) {
        try {
            Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("JWT validation failed: {}", e.getMessage());
            return false;
        }
    }

    private SecretKey getSigningKey() {
        return signingKey;
    }
}
