package project.TimeManager.adapter.out.persistence.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import project.TimeManager.domain.tag.model.TagType;
import project.TimeManager.domain.tag.model.TimerState;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "tag")
@Getter
@Setter
@NoArgsConstructor
public class TagJpaEntity {

    @Id
    @GeneratedValue
    @Column(name = "tag_id")
    private Long id;

    private String name;

    @Enumerated(EnumType.STRING)
    private TagType type = TagType.CUSTOM;

    private Long elapsedTime = 0L;
    private Long dailyGoalTime = 0L;
    private Long dailyElapsedTime = 0L;
    private Long dailyTotalTime = 0L;
    private Long tagTotalTime = 0L;
    private Long totalTime = 0L;

    private ZonedDateTime latestStartTime = ZonedDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneId.systemDefault());
    private ZonedDateTime latestStopTime = ZonedDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneId.systemDefault());

    @Enumerated(EnumType.STRING)
    private TimerState timerState = TimerState.STOPPED;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id")
    private MemberJpaEntity member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private TagJpaEntity parent;

    @OneToMany(mappedBy = "parent", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TagJpaEntity> children = new ArrayList<>();

    @OneToMany(mappedBy = "tag")
    private List<RecordJpaEntity> records = new ArrayList<>();

    public Long getParentId() {
        return parent != null ? parent.getId() : null;
    }
}
