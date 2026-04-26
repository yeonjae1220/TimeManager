package project.TimeManager.adapter.in.web.dto.response;

import project.TimeManager.application.dto.result.TagResult;
import project.TimeManager.domain.tag.model.TagType;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class TagTreeResponse extends BaseTagResponse {

    private List<TagTreeResponse> children = new ArrayList<>();

    public static TagTreeResponse from(TagResult result) {
        TagTreeResponse r = new TagTreeResponse();
        populate(r, result);
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
        nodeMap.values().forEach(node ->
                node.getChildren().sort(Comparator.comparingInt(n -> n.getDisplayOrder() != null ? n.getDisplayOrder() : 0)));
        return roots;
    }

    public List<TagTreeResponse> getChildren() { return children; }
}
