package project.TimeManager.adapter.out.persistence.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Duration;
import java.time.ZonedDateTime;

@Entity
@Table(name = "record")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RecordJpaEntity {

    @Id
    @GeneratedValue
    @Column(name = "record_id")
    private Long id;

    private ZonedDateTime startTime;
    private ZonedDateTime endTime;
    private Long totalTime = 0L;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tag_id")
    private TagJpaEntity tag;

    public RecordJpaEntity(TagJpaEntity tag, ZonedDateTime startTime, ZonedDateTime endTime) {
        this.tag = tag;
        this.startTime = startTime;
        this.endTime = endTime;
        this.totalTime = Duration.between(startTime, endTime).toSeconds();
    }
}
