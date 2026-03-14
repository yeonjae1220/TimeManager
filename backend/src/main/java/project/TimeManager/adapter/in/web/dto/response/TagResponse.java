package project.TimeManager.adapter.in.web.dto.response;

import project.TimeManager.application.dto.result.TagResult;

import java.util.List;

public class TagResponse extends BaseTagResponse {

    private List<Long> childrenList;

    public static TagResponse from(TagResult result) {
        TagResponse r = new TagResponse();
        populate(r, result);
        r.childrenList = result.getChildrenList();
        return r;
    }

    public List<Long> getChildrenList() { return childrenList; }
}
