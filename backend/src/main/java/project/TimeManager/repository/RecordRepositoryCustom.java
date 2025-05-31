package project.TimeManager.repository;

import project.TimeManager.dto.RecordDto;

import java.util.List;

public interface RecordRepositoryCustom {
    //    public void updateTagTimesBatch(List<Long> tagIds, Long deltaTime);
    public List<RecordDto> findAllRecordDtoByTagId(Long tagId);
}
