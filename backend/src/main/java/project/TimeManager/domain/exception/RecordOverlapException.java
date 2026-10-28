package project.TimeManager.domain.exception;

import project.TimeManager.domain.port.out.record.FindOverlappingRecordsPort.OverlapResult;

import java.util.List;

/**
 * 새 Record 의 시간대가 기존 Record 와 겹칠 때 발생합니다.
 * {@code overlaps} 에 겹치는 기록 목록을 담아 클라이언트가 2단계 확인 모달을 구성할 수 있도록 합니다.
 */
public class RecordOverlapException extends RuntimeException {

    private final List<OverlapResult> overlaps;

    public RecordOverlapException(List<OverlapResult> overlaps) {
        super("해당 시간대에 겹치는 기록이 있습니다");
        this.overlaps = List.copyOf(overlaps);
    }

    public List<OverlapResult> getOverlaps() {
        return overlaps;
    }
    public static String token(java.util.List<project.TimeManager.domain.port.out.record.FindOverlappingRecordsPort.OverlapResult> overlaps) {
        String value = overlaps.stream().sorted(java.util.Comparator.comparing(o -> o.recordId()))
            .map(o -> o.recordId() + ":" + o.tagId() + ":" + o.startTime().toInstant() + ":" + o.endTime().toInstant())
            .collect(java.util.stream.Collectors.joining("|"));
        try {
            return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
