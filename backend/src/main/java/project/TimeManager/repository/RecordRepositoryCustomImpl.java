package project.TimeManager.repository;

import com.querydsl.jpa.impl.JPAQueryFactory;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;
import project.TimeManager.dto.QRecordDto;
import project.TimeManager.dto.QTagDto;
import project.TimeManager.dto.RecordDto;
import project.TimeManager.dto.TagDto;
import project.TimeManager.entity.QRecords;

import java.util.List;

import static project.TimeManager.entity.QRecords.*;
import static project.TimeManager.entity.QTag.tag;

@RequiredArgsConstructor
@Repository
@Slf4j
public class RecordRepositoryCustomImpl implements RecordRepositoryCustom{
    private final EntityManager em;
    private final JPAQueryFactory jpaQueryFactory;

//    @Override
//    public void updateTagTimesBatch(List<Long> tagIds, Long deltaTime) {
//        log.info("checkpoint3-repository-tagIdList" + tagIds + " deltaTime = " + deltaTime);
//        // 한 번의 쿼리로 여러 태그의 totalTime을 업데이트
//        jpaQueryFactory.update(tag)
//                .set(tag.totalTime, tag.totalTime.add(deltaTime)) // totalTime에 deltaTime을 더함
//                .where(tag.id.in(tagIds)) // 주어진 tagIds 리스트에 해당하는 태그만 업데이트
//                        //.and(tag.TotalTime.add(deltaTime).goe(0)))  // totalTime이 음수가 되지 않도록 조건 추가)
//                .execute();  // 실행
//    }


    @Override
    public List<RecordDto> findAllRecordDtoByTagId(Long tagId) {
//        return jpaQueryFactory
//                .select(new QRecordDto(
//                        records
//                ))
//                .from(records)
//                .where(records.tag.id.eq(tagId))
//                .orderBy(records.startTime.desc())
//                .fetch();


    List<RecordDto> records = jpaQueryFactory
                .select(new QRecordDto(
                        QRecords.records
                ))
                .from(QRecords.records)
//                .where(QRecords.records.tag.id.eq(tagId))
                .orderBy(QRecords.records.startTime.desc())
                .fetch();

        // ✅ 데이터가 제대로 오는지 확인
        log.info("Records for tagId {}: {}", tagId, records);
        log.info("id check recordId {} : paramId {}", QRecords.records.tag.id, tagId);

        return records;


    }


}
