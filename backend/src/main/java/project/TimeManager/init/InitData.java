package project.TimeManager.init;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import project.TimeManager.adapter.out.persistence.entity.MemberJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;
import project.TimeManager.adapter.out.persistence.repository.MemberJpaRepository;
import project.TimeManager.adapter.out.persistence.repository.TagJpaRepository;
import project.TimeManager.application.dto.command.CreateRecordCommand;
import project.TimeManager.application.dto.command.CreateTagCommand;
import project.TimeManager.application.port.in.member.CreateMemberUseCase;
import project.TimeManager.application.port.in.record.CreateRecordUseCase;
import project.TimeManager.application.port.in.tag.CreateTagUseCase;
import project.TimeManager.domain.tag.model.TagType;

import java.time.ZoneId;
import java.time.ZonedDateTime;

@Profile("local")
@Component
@RequiredArgsConstructor
public class InitData {

    private final LocalInitDataService localInitDataService;

    @PostConstruct
    public void init() {
        localInitDataService.init();
    }

    @Component
    @RequiredArgsConstructor
    static class LocalInitDataService {

        private final CreateMemberUseCase createMemberUseCase;
        private final CreateTagUseCase createTagUseCase;
        private final CreateRecordUseCase createRecordUseCase;
        private final MemberJpaRepository memberJpaRepository;
        private final TagJpaRepository tagJpaRepository;

        public void init() {
            Long memberId1 = createMemberUseCase.createMember("member1");
            createMemberUseCase.createMember("member2");

            MemberJpaEntity member1 = memberJpaRepository.findById(memberId1).orElseThrow();
            TagJpaEntity rootTag = tagJpaRepository.findByTypeAndMember(TagType.ROOT, member1).orElseThrow();

            Long parentTagId = createTagUseCase.createTag(
                    new CreateTagCommand("ParentTag", memberId1, rootTag.getId()));
            Long childTag1Id = createTagUseCase.createTag(
                    new CreateTagCommand("ChildTag1", memberId1, parentTagId));
            Long childTag2Id = createTagUseCase.createTag(
                    new CreateTagCommand("ChildTag2", memberId1, parentTagId));
            Long childTag1_1Id = createTagUseCase.createTag(
                    new CreateTagCommand("ChildTag1_1", memberId1, childTag1Id));

            ZonedDateTime t1s = ZonedDateTime.of(2024, 12, 5, 10, 30, 0, 0, ZoneId.of("Asia/Seoul"));
            ZonedDateTime t1e = ZonedDateTime.of(2024, 12, 5, 11, 30, 0, 0, ZoneId.of("Asia/Seoul"));
            ZonedDateTime t2s = ZonedDateTime.of(2024, 12, 5, 18, 30, 0, 0, ZoneId.of("Asia/Seoul"));
            ZonedDateTime t2e = ZonedDateTime.of(2024, 12, 5, 20, 40, 0, 0, ZoneId.of("Asia/Seoul"));
            ZonedDateTime t3s = ZonedDateTime.of(2024, 12, 5, 13, 0, 0, 0, ZoneId.of("Asia/Seoul"));
            ZonedDateTime t3e = ZonedDateTime.of(2024, 12, 5, 13, 30, 0, 0, ZoneId.of("Asia/Seoul"));
            ZonedDateTime t4s = ZonedDateTime.of(2024, 12, 5, 13, 40, 0, 0, ZoneId.of("Asia/Seoul"));
            ZonedDateTime t4e = ZonedDateTime.of(2024, 12, 5, 14, 0, 0, 0, ZoneId.of("Asia/Seoul"));

            createRecordUseCase.createRecord(new CreateRecordCommand(parentTagId, t1s, t1e));
            createRecordUseCase.createRecord(new CreateRecordCommand(parentTagId, t2s, t2e));
            createRecordUseCase.createRecord(new CreateRecordCommand(childTag1Id, t3s, t3e));
            createRecordUseCase.createRecord(new CreateRecordCommand(childTag1_1Id, t4s, t4e));
        }
    }
}
