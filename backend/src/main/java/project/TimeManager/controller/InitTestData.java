package project.TimeManager.controller;

import jakarta.annotation.PostConstruct;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.Service.RecordService;
import project.TimeManager.entity.Member;
import project.TimeManager.entity.Tag;
import project.TimeManager.entity.TagType;
import project.TimeManager.repository.TagRepository;

import java.time.ZoneId;
import java.time.ZonedDateTime;

@Profile("test")
@Component
@RequiredArgsConstructor
public class InitTestData {
    private final InitTestDataService initTestDataService;

    @PostConstruct
    public void init() {
        initTestDataService.init();
    }

    @Component
    static class InitTestDataService {

        @PersistenceContext
        EntityManager em;

        @Autowired
        private RecordService recordService;  // RecordService 주입

        @Autowired
        private TagRepository tagRepository;

        @Transactional
        public void init() {
            Member member1 = new Member("member1");
            Member member2 = new Member("member2");
            em.persist(member1);
            em.persist(member2);

            Tag rootTag = tagRepository.findByTypeAndMember(TagType.ROOT, member1).get();

            Tag parentTag = new Tag("ParentTag", member1, rootTag);
            // parentTag.updateParentTag(parentTag);
            Tag childTag1 = new Tag("ChildTag1", member1, parentTag);
            Tag childTag2 = new Tag("ChildTag2", member1, parentTag);
            Tag childTag1_1 = new Tag("ChildTag1_1", member1, childTag1);

            em.persist(parentTag);
            em.persist(childTag1);
            em.persist(childTag2);
            em.persist(childTag1_1);

            // 고정된 테스트용 시간 생성
            ZonedDateTime testTime1s = ZonedDateTime.of(2024, 12, 5, 10, 30, 0, 0, ZoneId.of("Asia/Seoul"));
            ZonedDateTime testTime1e = ZonedDateTime.of(2024, 12, 5, 11, 30, 0, 0, ZoneId.of("Asia/Seoul"));
            ZonedDateTime testTime2s = ZonedDateTime.of(2024, 12, 5, 18, 30, 0, 0, ZoneId.of("Asia/Seoul"));
            ZonedDateTime testTime2e = ZonedDateTime.of(2024, 12, 5, 20, 40, 0, 0, ZoneId.of("Asia/Seoul"));
            ZonedDateTime testTime1_1s = ZonedDateTime.of(2024, 12, 5, 13, 0, 0, 0, ZoneId.of("Asia/Seoul"));
            ZonedDateTime testTime1_1e = ZonedDateTime.of(2024, 12, 5, 13, 30, 0, 0, ZoneId.of("Asia/Seoul"));
            ZonedDateTime testTime1_1_1s = ZonedDateTime.of(2024, 12, 5, 13, 40, 0, 0, ZoneId.of("Asia/Seoul"));
            ZonedDateTime testTime1_1_1e = ZonedDateTime.of(2024, 12, 5, 14, 0, 0, 0, ZoneId.of("Asia/Seoul"));

            recordService.createRecord(parentTag, testTime1s, testTime1e);
            recordService.createRecord(parentTag, testTime2s, testTime2e);
            recordService.createRecord(childTag1, testTime1_1s, testTime1_1e);
            recordService.createRecord(childTag1_1, testTime1_1_1s, testTime1_1_1e);

//            Records record1 = new Records(parentTag, testTime1s, testTime1e);
//            Records record2 = new Records(parentTag, testTime2s, testTime2e);
//            Records record1_1 = new Records(childTag1, testTime1_1s, testTime1_1e);
//            Records record1_1_1 = new Records(childTag1_1, testTime1_1_1s, testTime1_1_1e);
//            em.persist(record1);
//            em.persist(record2);
//            em.persist(record1_1);
//            em.persist(record1_1_1);

            // Tag의 totalTime이 여기서 단순 생성자로 생성해서 업데이트가 안됨.

            // record1.RecordCompleted(testTime1e);

//            parentTag.addChildTag(childTag1);
//            parentTag.addChildTag(childTag2);
//            childTag1.addChildTag(childTag1_1);


            member1.addTag(parentTag);


        }


    }
}

