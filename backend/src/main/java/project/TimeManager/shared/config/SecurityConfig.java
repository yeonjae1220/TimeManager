package project.TimeManager.shared.config;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.core.env.Environment;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import project.TimeManager.shared.security.internal.ServiceTokenAuthFilter;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import project.TimeManager.adapter.in.web.security.JwtAuthenticationFilter;

import java.util.Arrays;
import java.util.List;

@Slf4j
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final Environment environment;

    /**
     * TM1: cors.allowed-origins 빈값 처리 명확화
     * - 미설정(빈 문자열): CORS 설정 미등록 → same-origin 요청만 허용 (k8s 운영 환경)
     * - 설정 시: 명시된 오리진만 허용 (로컬 개발: http://localhost:3000,http://localhost:5173)
     */
    @Value("${cors.allowed-origins:}")
    private String allowedOriginsRaw;

    /** 콘솔 집계용 서비스 토큰 — 미설정 시 /api/internal/** 전부 차단(fail-closed) */
    @Value("${console.internal-token:}")
    private String consoleInternalToken;

    @Value("${admin.email}")
    private String adminEmail;

    /** BCrypt hash — k8s Secret ADMIN_PASSWORD_BCRYPT 에서 주입 */
    @Value("${admin.password.bcrypt}")
    private String adminPasswordBcrypt;

    private static final java.util.Set<String> KNOWN_TEST_HASHES = java.util.Set.of(
            "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi."
    );

    @PostConstruct
    public void validateAdminCredentials() {
        boolean isTest = Arrays.asList(environment.getActiveProfiles()).contains("test");
        if (isTest) {
            log.info("[Admin] test 프로파일 — admin 자격증명 검증 생략");
            return;
        }
        if (adminEmail == null || adminEmail.isBlank()) {
            throw new IllegalStateException("[Admin] ADMIN_EMAIL 환경변수가 설정되지 않았습니다.");
        }
        if (adminEmail.endsWith(".local") || adminEmail.endsWith(".example.com")) {
            throw new IllegalStateException(
                    "[Admin] ADMIN_EMAIL 기본값이 운영 환경에서 사용되었습니다. ADMIN_EMAIL을 실제 값으로 설정하세요.");
        }
        if (adminPasswordBcrypt == null
                || adminPasswordBcrypt.contains("placeholder")
                || adminPasswordBcrypt.length() < 60
                || (!adminPasswordBcrypt.startsWith("$2a$")
                    && !adminPasswordBcrypt.startsWith("$2b$")
                    && !adminPasswordBcrypt.startsWith("$2y$"))) {
            throw new IllegalStateException(
                    "[Admin] ADMIN_PASSWORD_BCRYPT가 유효한 BCrypt 해시가 아닙니다.");
        }
        if (KNOWN_TEST_HASHES.contains(adminPasswordBcrypt)) {
            throw new IllegalStateException(
                    "[Admin] ADMIN_PASSWORD_BCRYPT가 공개된 테스트 해시입니다. 운영 환경에서 사용할 수 없습니다.");
        }
        log.info("[Admin] admin 계정 설정이 유효합니다: email={}", adminEmail);
    }

    @Bean
    public BCryptPasswordEncoder bCryptPasswordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public UserDetailsService adminUserDetailsService() {
        var admin = User.builder()
                .username(adminEmail)
                .password(adminPasswordBcrypt)
                .authorities("ADMIN")
                .build();
        return new InMemoryUserDetailsManager(admin);
    }

    @Bean
    public AuthenticationManager adminAuthenticationManager() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(adminUserDetailsService());
        provider.setPasswordEncoder(bCryptPasswordEncoder());
        return new ProviderManager(provider);
    }

    /**
     * 콘솔 집계 전용 Security chain (서비스 토큰, 읽기 전용).
     * /api/internal/** 만 담당. ServiceTokenAuthFilter가 X-Internal-Token을 상수시간 비교로 검증.
     * AntPathRequestMatcher 명시 — MVC 존재 시 securityMatcher(String)이 핸들러 기반으로 해석돼
     * 핸들러 없는 경로를 놓치는 것을 방지 (GLOBAL-PIT-040).
     */
    @Bean
    @Order(0)
    public SecurityFilterChain internalConsoleFilterChain(HttpSecurity http) throws Exception {
        return http
                .securityMatcher(AntPathRequestMatcher.antMatcher("/api/internal/**"))
                .csrf(AbstractHttpConfigurer::disable)
                .cors(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .addFilterBefore(new ServiceTokenAuthFilter(consoleInternalToken),
                        UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    /**
     * Admin 전용 Security chain (세션 기반).
     * /admin/** 경로만 담당. formLogin + httpOnly 세션 쿠키로 인증.
     * AntPathRequestMatcher 명시 — POST /admin/login은 핸들러 없이 formLogin 필터가 처리하므로
     * String 매처(MvcRequestMatcher)면 매칭 실패해 메인 체인 401이 난다 (GLOBAL-PIT-040).
     */
    @Bean
    @Order(1)
    public SecurityFilterChain adminFilterChain(HttpSecurity http) throws Exception {
        return http
                .securityMatcher(AntPathRequestMatcher.antMatcher("/admin/**"))
                .authenticationManager(adminAuthenticationManager())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/admin/login").permitAll()
                        .anyRequest().hasAuthority("ADMIN")
                )
                .formLogin(form -> form
                        .loginPage("/admin/login")
                        .loginProcessingUrl("/admin/login")
                        .defaultSuccessUrl("/admin/dashboard", true)
                        .failureUrl("/admin/login?error")
                        .permitAll()
                )
                .logout(logout -> logout
                        .logoutUrl("/admin/logout")
                        .logoutSuccessUrl("/admin/login?logout")
                        .invalidateHttpSession(true)
                        .deleteCookies("JSESSIONID")
                )
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                        .sessionFixation().changeSessionId()
                        .maximumSessions(1)
                )
                .csrf(Customizer.withDefaults()) // MEDIUM-1 fix: withDefaults()로 의도 명확화
                .headers(headers -> headers
                        .contentSecurityPolicy(csp -> csp.policyDirectives(
                                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'"))
                        .frameOptions(f -> f.deny())
                )
                .build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();

        if (allowedOriginsRaw != null && !allowedOriginsRaw.isBlank()) {
            List<String> origins = Arrays.stream(allowedOriginsRaw.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .toList();

            CorsConfiguration config = new CorsConfiguration();
            config.setAllowedOrigins(origins);
            config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
            config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept"));
            config.setAllowCredentials(true);
            config.setMaxAge(3600L);
            source.registerCorsConfiguration("/**", config);
        }

        return source;
    }

    @Bean
    @Order(2)
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .headers(headers -> headers
                        .frameOptions(fo -> fo.deny())
                        .contentTypeOptions(Customizer.withDefaults())
                        .httpStrictTransportSecurity(hsts -> hsts.maxAgeInSeconds(31536000).includeSubDomains(true))
                        .contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'self'"))
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, "/api/v1/members").permitAll()
                        .requestMatchers("/api/v1/auth/**").permitAll()
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers("/actuator/**").hasAuthority("ADMIN")
                        .requestMatchers("/tt/**").authenticated()
                        .requestMatchers("/api/v1/admin/**").hasAuthority("ADMIN")
                        .anyRequest().authenticated()
                )
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType("application/json;charset=UTF-8");
                            response.getWriter().write("{\"error\":\"인증이 필요합니다\"}");
                        })
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * JwtAuthenticationFilter를 서블릿 필터로 자동 등록하지 않도록 막는다.
     * /admin/** 요청에 JWT 필터가 끼어들지 않게 하기 위함.
     */
    @Bean
    public FilterRegistrationBean<JwtAuthenticationFilter> jwtFilterRegistration() {
        FilterRegistrationBean<JwtAuthenticationFilter> reg = new FilterRegistrationBean<>(jwtAuthenticationFilter);
        reg.setEnabled(false);
        return reg;
    }
}
