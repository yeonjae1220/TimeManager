package project.TimeManager.Service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.dto.RecordDto;
import project.TimeManager.entity.Records;
import project.TimeManager.entity.Tag;
import project.TimeManager.entity.TagType;
import project.TimeManager.repository.RecordRepository;
import project.TimeManager.repository.TagRepository;

import java.time.Duration;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
@Slf4j
public class RecordService {
    private EntityManager em;
    private final TagRepository tagRepository;
    private final RecordRepository recordRepository;

    /*
    startTime, endTime을 모두 받아서 Record 저장.
    TagTotalTime도 함께 업데이트 함
     */
    @Transactional
    public Long createRecord(Tag tag, ZonedDateTime startTime, ZonedDateTime endTime) {
        log.info("tagId : " + tag.getId() +  " startTime : " + startTime + "endTime : " + endTime);
        Records record = new Records(tag, startTime, endTime);
        recordRepository.save(record);
        // recordRepository.save(record);  // 변경 감지로 자동 저장되지만 명시적으로 호출
        // tag.updateTagTotalTime(record.getTotalTime());

        log.info("tagTotalTime 확인 : " + tag.getTagTotalTime() + " tag 데일리 시간 확인 : "+ tag.getDailyElapsedTime() + " tag 총 시간 확인 : " + tag.getTotalTime() + " record 총 시간 확인 로그 : " + record.getTotalTime() + " 시작시간 : " + record.getStartTime() + " 종료 시간 + " + record.getEndTime());

        // initData에서 아래 두 속성이 첫번째만 적용되고 나머지는 다 0 으로 저장된다. 이유를 모르겠다..
        // 그래도 웹 페이지에서 생성된 새로운 record는 전부 적용이 제대로 되는 것을 확인
        tag.editDailyTotalTime(record.getTotalTime());
        tag.editTagTotalTime(record.getTotalTime()); // tagTotalTime도 변경
        // tagRepository.save(tag); // initData의 dailyTotalTime, tagTotalTime이 저장이 안되서 추가
        updateTagTimeBatch(tag, record.getTotalTime());

        return record.getId();
    }

    // 위랑 매개변수 받아오는 것만 다름. RecordApiController 에서 CreateRecord를 처리하기 위해 하나 새로 만듬
    @Transactional
    public Long createRecordWithId(Long tagId,  ZonedDateTime startTime, ZonedDateTime endTime) {
        Tag tag = tagRepository.findById(tagId)
                .orElseThrow(() -> new EntityNotFoundException("Tag Not Found"));

        Records record = new Records(tag, startTime, endTime);
        recordRepository.save(record);
        tag.editDailyTotalTime(record.getTotalTime());
        tag.editTagTotalTime(record.getTotalTime()); // tagTotalTime도 변경
        updateTagTimeBatch(tag, record.getTotalTime());
        return record.getId();
    }

    public List<RecordDto> findAllRecordDtoByTagId (Long tagId) {
        return recordRepository.findAllRecordDtoByTagId(tagId);

    }

    // 타이머 작동
    // 스톱워치 종료 및 Record 저장
    // 이거 tag로 옮기는게 좋지 않나?
    @Transactional
    public Long stopStopwatch(Long tagId, Long elapsedTime, ZonedDateTime startTime, ZonedDateTime endTime) {
        log.info("ServiceStartTime : " + startTime + " ServiceStopTime : " + endTime);
        Tag tag = tagRepository.findById(tagId)
                .orElseThrow(() -> new RuntimeException("Tag not found"));

        // 여기서 이렇게 바꿔도 되려나
        tag.stopStopwatch(endTime);
        tag.saveElapsedTime(elapsedTime);
        tag.stopState();
        // tag.saveDailyTotalTime(Duration.between(startTime, endTime).getSeconds()); // 초단위라 나중에 오차가 예상됨

        return createRecord(tag, startTime, endTime);
    }

    /*
    updateTime
     */
    @Transactional
    public void editStartTime(Records record, ZonedDateTime startTime) {
        Long deltaTime = record.getTotalTime();
        record.editStartTime(startTime);
        deltaTime = record.getTotalTime() - deltaTime;

        record.getTag().editTagTotalTime(deltaTime); // 이건 그냥 엔티티에서 변경 한 후 더티체킹으로 업데이트 가능?

        updateTagTimeBatch(record.getTag(), deltaTime);
    }

    @Transactional
    public void editEndTime(Records record, ZonedDateTime endTime) {
        Long deltaTime = record.getTotalTime();
        record.editEndTime(endTime);
        deltaTime = record.getTotalTime() - deltaTime;

        record.getTag().editTagTotalTime(deltaTime); // 이건 그냥 엔티티에서 변경 한 후 더티체킹으로 업데이트 가능?

        log.info("checkpoint1-editEndTime" + deltaTime + " tagName and Id = " + record.getTag().getName() + " & " + record.getTag().getId());
        updateTagTimeBatch(record.getTag(), deltaTime);
    }

    @Transactional
    public Long editTime(Long recordId, ZonedDateTime startTime, ZonedDateTime endTime) {
        Records record = recordRepository.findById(recordId)
                .orElseThrow(() -> new EntityNotFoundException("Record not found"));

        Long deltaTime = record.getTotalTime();

        record.editStartTime(startTime);
        record.editEndTime(endTime);
        deltaTime = record.getTotalTime() - deltaTime;

        updateTagTimeBatch(record.getTag(), deltaTime);

        return record.getId();
    }

    @Transactional
    public void editParent(Tag newTag, Records record) {
        Long deltaTime = record.getTotalTime();
        updateTagTimeBatch(record.getTag(), deltaTime*(-1));
        record.editParentTag(newTag);
        updateTagTimeBatch(newTag, deltaTime);
    }

    /*
    createTag
     */



    /*
    updateTag
     */
    @Transactional
    public void updateTagTimeBatch(Tag tag, Long deltaTime) {
        List<Long> parentsTagId = new ArrayList<>();
        while (tag.getType() != TagType.ROOT && tag.getType() != TagType.DISCARDED) {
            log.info("tagId = " + tag.getId() + " tagName = " + tag.getName());
            parentsTagId.add(tag.getId());
            tag = tag.getParent();
        }
        parentsTagId.add(tag.getId()); // 마지막 Root Tag 까지 포함
        log.info("checkpoint2-updateTagTimeBatch, parentsTagID = " + parentsTagId);
        log.info("deltaTime = " + deltaTime);
        tagRepository.updateTagTimesBatch(parentsTagId, deltaTime);
    }


    /*
    delete
     */
    @Transactional
    public boolean deleteRecord(Long recordId) {
        Optional<Records> record = recordRepository.findById(recordId);

        if (record.isPresent()) {
            Tag tag = record.get().getTag();
            Long delta = record.get().getTotalTime();
            updateTagTimeBatch(tag, -delta);
            recordRepository.deleteById(recordId);
            return true;
        }
        return false;
    }
}
