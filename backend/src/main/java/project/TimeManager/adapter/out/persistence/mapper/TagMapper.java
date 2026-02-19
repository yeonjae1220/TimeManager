package project.TimeManager.adapter.out.persistence.mapper;

import org.springframework.stereotype.Component;
import project.TimeManager.adapter.out.persistence.entity.MemberJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;
import project.TimeManager.application.dto.result.TagResult;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.tag.model.Tag;
import project.TimeManager.domain.tag.model.TagId;
import project.TimeManager.domain.tag.model.TimerState;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class TagMapper {

    public Tag toDomain(TagJpaEntity entity) {
        TagId parentId = entity.getParent() != null
                ? TagId.of(entity.getParent().getId())
                : null;
        return Tag.reconstitute(
                TagId.of(entity.getId()),
                entity.getName(),
                entity.getType(),
                entity.getElapsedTime(),
                entity.getDailyGoalTime(),
                entity.getDailyElapsedTime(),
                entity.getDailyTotalTime(),
                entity.getTagTotalTime(),
                entity.getTotalTime(),
                entity.getLatestStartTime(),
                entity.getLatestStopTime(),
                entity.getTimerState(),
                MemberId.of(entity.getMember().getId()),
                parentId
        );
    }

    public void updateJpaEntity(TagJpaEntity entity, Tag domain) {
        entity.setName(domain.getName());
        entity.setType(domain.getType());
        entity.setElapsedTime(domain.getElapsedTime());
        entity.setDailyGoalTime(domain.getDailyGoalTime());
        entity.setDailyElapsedTime(domain.getDailyElapsedTime());
        entity.setDailyTotalTime(domain.getDailyTotalTime());
        entity.setTagTotalTime(domain.getTagTotalTime());
        entity.setTotalTime(domain.getTotalTime());
        entity.setLatestStartTime(domain.getLatestStartTime());
        entity.setLatestStopTime(domain.getLatestStopTime());
        entity.setTimerState(domain.getTimerState());
    }

    public TagJpaEntity toNewJpaEntity(Tag domain, MemberJpaEntity member, TagJpaEntity parent) {
        TagJpaEntity entity = new TagJpaEntity();
        entity.setName(domain.getName());
        entity.setType(domain.getType());
        entity.setElapsedTime(domain.getElapsedTime());
        entity.setDailyGoalTime(domain.getDailyGoalTime());
        entity.setDailyElapsedTime(domain.getDailyElapsedTime());
        entity.setDailyTotalTime(domain.getDailyTotalTime());
        entity.setTagTotalTime(domain.getTagTotalTime());
        entity.setTotalTime(domain.getTotalTime());
        entity.setLatestStartTime(domain.getLatestStartTime());
        entity.setLatestStopTime(domain.getLatestStopTime());
        entity.setTimerState(domain.getTimerState() != null ? domain.getTimerState() : TimerState.STOPPED);
        entity.setMember(member);
        entity.setParent(parent);
        return entity;
    }

    public TagResult toResult(TagJpaEntity entity) {
        Long parentId = entity.getParent() != null ? entity.getParent().getId() : null;
        boolean isRunning = entity.getTimerState() == TimerState.RUNNING;
        List<Long> childrenList = entity.getChildren().stream()
                .map(TagJpaEntity::getId)
                .collect(Collectors.toList());
        return new TagResult(
                entity.getId(),
                entity.getName(),
                entity.getType(),
                entity.getElapsedTime(),
                entity.getDailyGoalTime(),
                entity.getDailyElapsedTime(),
                entity.getDailyTotalTime(),
                entity.getTagTotalTime(),
                entity.getTotalTime(),
                entity.getLatestStartTime(),
                entity.getLatestStopTime(),
                isRunning,
                entity.getMember().getId(),
                parentId,
                childrenList
        );
    }
}
