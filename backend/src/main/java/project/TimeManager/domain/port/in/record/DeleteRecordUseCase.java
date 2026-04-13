package project.TimeManager.domain.port.in.record;

public interface DeleteRecordUseCase {
    boolean deleteRecord(Long recordId, Long memberId);
}
