package project.TimeManager.domain.port.out.tag;

public interface UpdateTagTimeBatchPort {
    void updateTagTimeBatch(Long startTagId, Long deltaTime);
}
