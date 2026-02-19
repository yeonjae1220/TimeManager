package project.TimeManager.adapter.in.web.dto.response;

import project.TimeManager.application.dto.result.TagResult;
import project.TimeManager.domain.tag.model.TagType;

import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class TagTreeResponse {
    private Long id;
    private String name;
    private TagType type;
    private Long elapsedTime;
    private Long dailyGoalTime;
    private Long dailyElapsedTime;
    private Long dailyTotalTime;
    private Long tagTotalTime;
    private Long totalTime;
    private ZonedDateTime latestStartTime;
    private ZonedDateTime latestStopTime;
    private Boolean state;
    private Long memberId;
    private Long parentId;
    private List<TagTreeResponse> children = new ArrayList<>();

    public static TagTreeResponse from(TagResult result) {
        TagTreeResponse r = new TagTreeResponse();
        r.id = result.getId();
        r.name = result.getName();
        r.type = result.getType();
        r.elapsedTime = result.getElapsedTime();
        r.dailyGoalTime = result.getDailyGoalTime();
        r.dailyElapsedTime = result.getDailyElapsedTime();
        r.dailyTotalTime = result.getDailyTotalTime();
        r.tagTotalTime = result.getTagTotalTime();
        r.totalTime = result.getTotalTime();
        r.latestStartTime = result.getLatestStartTime();
        r.latestStopTime = result.getLatestStopTime();
        r.state = result.getState();
        r.memberId = result.getMemberId();
        r.parentId = result.getParentId();
        return r;
    }

    public static List<TagTreeResponse> buildTree(List<TagResult> flatList) {
        Map<Long, TagTreeResponse> nodeMap = flatList.stream()
                .collect(Collectors.toMap(TagResult::getId, TagTreeResponse::from));

        List<TagTreeResponse> roots = new ArrayList<>();
        for (TagResult result : flatList) {
            TagTreeResponse node = nodeMap.get(result.getId());
            if (result.getType() != TagType.CUSTOM) {
                roots.add(node);
            } else {
                TagTreeResponse parent = nodeMap.get(result.getParentId());
                if (parent != null) {
                    parent.getChildren().add(node);
                }
            }
        }
        return roots;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public TagType getType() { return type; }
    public Long getElapsedTime() { return elapsedTime; }
    public Long getDailyGoalTime() { return dailyGoalTime; }
    public Long getDailyElapsedTime() { return dailyElapsedTime; }
    public Long getDailyTotalTime() { return dailyTotalTime; }
    public Long getTagTotalTime() { return tagTotalTime; }
    public Long getTotalTime() { return totalTime; }
    public ZonedDateTime getLatestStartTime() { return latestStartTime; }
    public ZonedDateTime getLatestStopTime() { return latestStopTime; }
    public Boolean getState() { return state; }
    public Long getMemberId() { return memberId; }
    public Long getParentId() { return parentId; }
    public List<TagTreeResponse> getChildren() { return children; }
}
