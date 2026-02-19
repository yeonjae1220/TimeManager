package project.TimeManager.application.port.out.tag;

public interface UpdateTagTimeBatchPort {
    void updateTagTimeBatch(Long startTagId, Long deltaTime);
}
