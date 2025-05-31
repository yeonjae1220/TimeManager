package project.TimeManager.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.time.Duration;
import java.time.ZonedDateTime;

@Entity
//@Inheritance(strategy = InheritanceType.JOINED)
// 데이터 자주 조회하진 않을 것 같음. 차라리 무결성? 아니다 그냥 SINGLE로 하자. 수정 사함들 좀 들어올듯
//@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
//@DiscriminatorColumn(name = "dtype")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@ToString(of = {"id", "startTime", "endTime"})
public class Records {
    @Id
    @GeneratedValue
    @Column(name = "record_id")
    private Long id;

    // 이것 보다 그냥 처음 생성할 때 startTime, endTime을 Date.now() 같은걸로 같게 설정 해두는게 더 좋을 듯
    // null 허용하지 않는 편이 좋을듯 함

    private ZonedDateTime startTime;
    // @Column(nullable = true)
    private ZonedDateTime endTime; // = null;  // 명시적으로 null 설정
    private Long totalTime = 0L; // 초 단위로 기록


    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tag_id")
    private Tag tag;

    // 쓸 일 있을까?
    public Records(ZonedDateTime startTime) {
        this.startTime = startTime;
        this.endTime = startTime;
    }
    // 얘도 쓸 일 있을까?
    public void RecordCompleted(ZonedDateTime endTime) {
        this.endTime = endTime;
        calculateToTalTime();
        this.getTag().updateTagTotalTime(this.getTotalTime());
    }

    public Records(Tag tag, ZonedDateTime startTime, ZonedDateTime endTime) {
        this.tag = tag;
        this.startTime = startTime;
        this.endTime = endTime;
        calculateToTalTime();
        tag.getRecords().add(this);
    }

    // 총 시간 게산, tag의 totalTime도 업데이트
    // Tag Total Time도 업데이트 해야함
    public void calculateToTalTime() {
        this.totalTime = Duration.between(startTime, endTime).toSeconds();
    }

    // 시간 수정
    public void editStartTime(ZonedDateTime startTime) {
        this.startTime = startTime;
        calculateToTalTime();
    }

    public void editEndTime(ZonedDateTime endTime) {
        this.endTime = endTime;
        calculateToTalTime();
    }

    // 여기서 Tag를 찾아오게 되는데 쿼리 나가는거 최적화 해줘야 함
    // 예외 처리도 생각해야 할 듯
    public void editParentTag(Tag parentTag) {
        this.tag.getRecords().remove(this);
        this.tag = parentTag;
    }


    /* For test */
    public Records(Tag tag, ZonedDateTime startTime) {
        this.tag = tag;
        this.startTime = startTime;
        this.endTime = startTime;
    }


}
