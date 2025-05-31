package project.TimeManager.Service;

import jakarta.persistence.EntityManager;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.entity.Records;
import project.TimeManager.entity.Tag;
import project.TimeManager.entity.TagType;
import project.TimeManager.repository.TagRepository;


import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@Transactional
class RecordServiceTest {
    @Autowired
    private TagRepository tagRepository;
    @Autowired
    private RecordService recordService;
    @Autowired
    private EntityManager em;
    @Test
    public void updateTimeWithParentTag() {
        Tag child2 = tagRepository.findByName("ChildTag1_1").get();
        List<Records> child2RecordsList = child2.getRecords();
        assertThat(child2RecordsList.get(0).getTotalTime()).isEqualTo(1200);

        assertThat(child2.getTotalTime()).isEqualTo(1200);
        assertThat(child2.getParent().getTotalTime()).isEqualTo(1200 + 1800);
        assertThat(tagRepository.findByTypeAndMember(TagType.ROOT, child2.getMember()).get().getTotalTime()).isEqualTo(14400);

        System.out.println("child2TagBefore = " + child2.getTotalTime());
        recordService.editEndTime(child2RecordsList.get(0), ZonedDateTime.of(2024, 12, 5, 13, 50, 0, 0, ZoneId.of("Asia/Seoul")));
        System.out.println("child2RecordsListEndTime = " + child2RecordsList.get(0).getEndTime() + " TotalTime = " + child2RecordsList.get(0).getTotalTime());

        Tag child2Re = tagRepository.findByName("ChildTag1_1").get();
        System.out.println("child2TagAfter = " + child2Re.getTotalTime());
        assertThat(child2Re.getTotalTime()).isEqualTo(600);
        assertThat(child2Re.getParent().getTotalTime()).isEqualTo(600 + 1800);

        recordService.editStartTime(child2RecordsList.get(0), ZonedDateTime.of(2024, 12, 5, 13, 30, 0, 0, ZoneId.of("Asia/Seoul")));
        Tag child2ReRe = tagRepository.findByName("ChildTag1_1").get();
        assertThat(child2ReRe.getTotalTime()).isEqualTo(1200);
        assertThat(child2ReRe.getParent().getTotalTime()).isEqualTo(1200 + 1800);

    }

    @Test
    public void editParent() {
        Tag childTag1_1 = tagRepository.findByName("ChildTag1_1").get();
        Tag childTag2 = tagRepository.findByName("ChildTag2").get();
        Records record = childTag1_1.getRecords().get(0);

        recordService.editParent(childTag2, record);

        childTag1_1 = tagRepository.findByName("ChildTag1_1").get();
        childTag2 = tagRepository.findByName("ChildTag2").get();

        assertThat(childTag1_1.getParent().getTotalTime()).isEqualTo(1800);
        assertThat(childTag2.getTotalTime()).isEqualTo(1200);

    }

    @Test
    public void checkInitDataTagTotalTime() {
        Tag root = tagRepository.findById(1L).get();
        Tag ParentTag = tagRepository.findByName("ParentTag").get();
        Tag ChildTag1 = tagRepository.findByName("ChildTag1").get();
        Tag ChildTag1_1 = tagRepository.findByName("ChildTag1_1").get();

        ZonedDateTime testTime1_1s = ZonedDateTime.of(2024, 12, 5, 15, 0, 0, 0, ZoneId.of("Asia/Seoul"));
        ZonedDateTime testTime1_1e = ZonedDateTime.of(2024, 12, 5, 16, 0, 0, 0, ZoneId.of("Asia/Seoul"));

        recordService.createRecord(ChildTag1, testTime1_1s, testTime1_1e);
        em.flush();
        em.clear();

        System.out.println("root = " + root.getTagTotalTime());
        System.out.println("ParentTag = " + ParentTag.getTagTotalTime());
        System.out.println("ChildTag1 = " + ChildTag1.getTagTotalTime());
        System.out.println("ChildTag1_1 = " + ChildTag1_1.getTagTotalTime());

        System.out.println("root = " + root.getTotalTime());
        System.out.println("ParentTag = " + ParentTag.getTotalTime());
        System.out.println("ChildTag1 = " + ChildTag1.getTotalTime());
        System.out.println("ChildTag1_1 = " + ChildTag1_1.getTotalTime());

    }



}