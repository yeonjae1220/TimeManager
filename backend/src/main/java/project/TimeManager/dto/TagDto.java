package project.TimeManager.dto;

import com.querydsl.core.annotations.QueryProjection;
import lombok.Data;
import lombok.NoArgsConstructor;
import project.TimeManager.entity.State;
import project.TimeManager.entity.Tag;
import project.TimeManager.entity.TagType;
import project.TimeManager.entity.*;

import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
public class TagDto {
    private Long id;
    private String name;
    private TagType type;
    private Long elapsedTime; // 타이머 시간
    private Long dailyGoalTime; // 목표 시간
    private Long dailyElapsedTime; // record 단위의 시간
    private Long dailyTotalTime; // 하루 총 시간
    private Long tagTotalTime; // 해당 태그에 투자한 총 시간
    private Long totalTime; // 해당 태그와 자식 태그를 합친 총 시간
    private ZonedDateTime latestStartTime;
    private ZonedDateTime latestStopTime;
    // private State state; // 상태 [RUN, STOP]
    private Boolean state;

    private Long memberId;
    private List<Long> records = new ArrayList<>();;
    private Long parentId;
//    private List<Long> childrenId;
    private List<TagDto> children = new ArrayList<>();  // 초기화하여 NPE 방지

    // private List<Records> records;

    // private Tag parent;

    // array 동시성?
    // private List<Tag> children = new ArrayList<>();
    List<Long> childrenList = new ArrayList<>();



    @QueryProjection
    public TagDto(Tag t) {
        this.id = t.getId();
        this.name = t.getName();
        this.type = t.getType();
        this.elapsedTime = t.getElapsedTime();
        this.dailyGoalTime = t.getDailyGoalTime();
        this.dailyElapsedTime = t.getDailyElapsedTime();
        this.dailyTotalTime = t.getDailyTotalTime();
        this.tagTotalTime = t.getTagTotalTime();
        this.totalTime = t.getTotalTime();
        this.latestStartTime = t.getLatestStartTime();
        this.latestStopTime = t.getLatestStartTime();
        this.state = t.getState();
        this.memberId = t.getMember().getId();
        // Record 리스트를 ID만 포함한 리스트로 변환
//        this.records = t.getRecords().stream()
//                .map(Record::getId)  // Record 엔티티에서 ID만 가져옴
//                .collect(Collectors.toList());
        this.records = t.RecordsIdList(); // 괜찮나?
        // this.parentId = t.getParent().getId();
        // 부모 ID 처리 (부모가 없으면 null 처리)
        this.parentId = t.getParent() != null ? t.getParent().getId() : null;

//        this.childrenId = t.ChildrenIdList(); // 얘도 괜찮나?
        // 자식 태그들 변환 (재귀적으로 TagDto로 변환)
//        this.children = t.getChildren()
//                .stream()
//                .map(TagDto::new) // 자식 태그도 TagDto로 변환
//                .collect(Collectors.toList());
        this.childrenList = t.ChildrenIdList(); // 괜찮나?

    }

}
