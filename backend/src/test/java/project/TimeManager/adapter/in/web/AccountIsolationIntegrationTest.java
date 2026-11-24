package project.TimeManager.adapter.in.web;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import project.TimeManager.adapter.in.web.security.JwtTokenProvider;
import project.TimeManager.adapter.out.persistence.entity.PushSubscriptionJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;
import project.TimeManager.adapter.out.persistence.repository.MemberJpaRepository;
import project.TimeManager.adapter.out.persistence.repository.PushSubscriptionRepository;
import project.TimeManager.adapter.out.persistence.repository.TagJpaRepository;
import project.TimeManager.application.service.notification.PushSender;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.member.model.MemberRole;
import project.TimeManager.domain.tag.model.TagType;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Testcontainers(disabledWithoutDocker = true)
class AccountIsolationIntegrationTest {
    @Container
    static final GenericContainer<?> postgres = new GenericContainer<>("postgres:16-alpine")
            .withEnv("POSTGRES_DB", "timemanager")
            .withEnv("POSTGRES_USER", "timemanager")
            .withEnv("POSTGRES_PASSWORD", "test-only")
            .withExposedPorts(5432);

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", () -> "jdbc:postgresql://%s:%d/timemanager"
                .formatted(postgres.getHost(), postgres.getMappedPort(5432)));
        properties.add("spring.datasource.username", () -> "timemanager");
        properties.add("spring.datasource.password", () -> "test-only");
        properties.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        properties.add("decorator.datasource.p6spy.enable-logging", () -> false);
    }

    @MockitoBean PushSender pushSender;
    @Autowired MockMvc mvc;
    @Autowired JwtTokenProvider tokens;
    @Autowired MemberJpaRepository members;
    @Autowired TagJpaRepository tags;
    @Autowired PushSubscriptionRepository subscriptions;
    @Autowired EntityManager em;

    private Long alice;
    private Long bob;
    private TagJpaEntity aliceRoot;
    private TagJpaEntity bobRoot;
    private String authorization;

    @BeforeEach
    void accounts() {
        var active = members.findAll().stream().filter(m -> m.getEmail().startsWith("member")).toList();
        alice = active.stream().filter(m -> m.getEmail().equals("member1@test.com")).findFirst().orElseThrow().getId();
        bob = active.stream().filter(m -> m.getEmail().equals("member2@test.com")).findFirst().orElseThrow().getId();
        aliceRoot = root(alice);
        bobRoot = root(bob);
        authorization = "Bearer " + tokens.generateAccessToken(MemberId.of(alice), MemberRole.MEMBER);
    }

    @Test
    void tagMutationsRejectOtherOwnersAndPreventCycles() throws Exception {
        var parent = tags.findByMemberId(alice).stream()
                .filter(t -> t.getName().equals("ParentTag")).findFirst().orElseThrow();
        var child = tags.findByMemberId(alice).stream()
                .filter(t -> t.getName().equals("ChildTag1")).findFirst().orElseThrow();
        long countBefore = tags.count();
        int bobOrder = bobRoot.getDisplayOrder();

        mvc.perform(post("/api/v1/tags").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tagName":"isolated","parentTagId":%d}
                                """.formatted(bobRoot.getId())))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/v1/tags/{id}", child.getId()).header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"newParentTagId":%d}
                                """.formatted(bobRoot.getId())))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/v1/tags/reorder").header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"parentTagId":%d,"orderedTagIds":[%d,%d]}
                                """.formatted(aliceRoot.getId(), parent.getId(), bobRoot.getId())))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/v1/tags/{id}", parent.getId()).header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"newParentTagId":%d}
                                """.formatted(child.getId())))
                .andExpect(status().isBadRequest());

        em.clear();
        assertThat(tags.count()).isEqualTo(countBefore);
        assertThat(tags.findById(child.getId()).orElseThrow().getParentId()).isEqualTo(parent.getId());
        assertThat(tags.findById(parent.getId()).orElseThrow().getParentId()).isEqualTo(aliceRoot.getId());
        assertThat(tags.findById(bobRoot.getId()).orElseThrow().getDisplayOrder()).isEqualTo(bobOrder);
    }

    @Test
    void pushUnsubscribeIsScopedToTheAuthenticatedOwner() throws Exception {
        String endpoint = "https://fcm.googleapis.com/fcm/send/local-fixture";
        subscriptions.saveAndFlush(new PushSubscriptionJpaEntity(bob, endpoint, "test-key", "test-auth"));
        String unsubscribe = """
                {"endpoint":"%s"}
                """.formatted(endpoint);
        mvc.perform(post("/api/v1/push/subscriptions/{id}", bob).header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"endpoint":"%s","keys":{"p256dh":"key","auth":"auth"}}
                                """.formatted(endpoint)))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/push/subscriptions/{id}", bob).header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(unsubscribe))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/push/subscriptions/{id}", alice).header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON).content(unsubscribe))
                .andExpect(status().isNoContent());

        assertThat(subscriptions.findByMemberId(bob)).extracting(PushSubscriptionJpaEntity::getEndpoint)
                .containsExactly(endpoint);
    }

    @Test
    void summaryReturnsDailyBucketsWithoutSessionDetails() throws Exception {
        mvc.perform(get("/api/v1/records/summary").header("Authorization", authorization)
                        .param("startDate", "2024-12-05").param("endDate", "2024-12-06")
                        .param("includeSessions", "false"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSeconds").value(14400))
                .andExpect(jsonPath("$.dailyTotals['2024-12-05']").value(14400))
                .andExpect(jsonPath("$.dailyTotals['2024-12-06']").value(0))
                .andExpect(jsonPath("$.tagSummaries[0].sessions").isEmpty());
        mvc.perform(get("/api/v1/records/summary").header("Authorization", authorization)
                        .param("startDate", "2024-12-06").param("endDate", "2024-12-05"))
                .andExpect(status().isBadRequest());
    }

    private TagJpaEntity root(Long memberId) {
        return tags.findByMemberId(memberId).stream().filter(t -> t.getType() == TagType.ROOT)
                .findFirst().orElseThrow();
    }
}
