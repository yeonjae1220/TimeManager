package project.TimeManager.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import project.TimeManager.Service.TagService;
import project.TimeManager.dto.CreateTagDto;
import project.TimeManager.dto.TagDto;
import project.TimeManager.dto.UpdateParentTagDto;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
//@ResponseBody 붙이는 것보다 이렇게 따로 해서 유지 보수성을 높혀본다.
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/tag")
public class TagApiController {
    private final TagService tagService;

    // 단순 화면 json 출력용
//    @GetMapping("/{memberId}")
//    public ResponseEntity<List<TagDto>> UserTagsData(@PathVariable Long memberId) {
//        List<TagDto> response = tagService.findTagListDtoByMemberId(memberId);
//        return ResponseEntity.ok(response);
//    }

    @GetMapping("/{memberId}")
    public List<TagDto> UserTagsData(@PathVariable Long memberId) {
        return tagService.findTagListDtoByMemberId(memberId);
    }

    @GetMapping("/detail/{tagId}")
    public TagDto TagDetailData(@PathVariable Long tagId) {
        return tagService.findOneTagDtoById(tagId);
    }

    // 시작 시간 저장 (Vue에서 전달)
    @PostMapping("/{tagId}/start")
    public ResponseEntity<Long> startStopwatch(@PathVariable Long tagId, @RequestBody ZonedDateTime startTime) {
        return ResponseEntity.ok(tagService.startStopwatch(tagId, startTime));
    }

    @PostMapping("/{tagId}/reset")
    public ResponseEntity<Long> resetStopwatch(@PathVariable Long tagId, @RequestBody Map<String, Long> request) {
        Long elapsedTime = request.get("elapsedTime");
        if (elapsedTime == null) {
            throw new IllegalArgumentException("elapsedTime 값이 필요합니다.");
        }
        return ResponseEntity.ok(tagService.resetStopwatch(tagId, elapsedTime));
    }

    // 멤버 데이터도 따로 넣어줘서 이상한데 업데이트 되거나 하는 거 방지? 아니면 확인 해주는 코드같은거 추가하는 것도 좋을 듯
    @PostMapping("/{tagId}/create")
    public ResponseEntity<Long> createTag(@PathVariable Long tagId, @RequestBody CreateTagDto createTagDto) {
        String tagName = createTagDto.getTagName();
        Long memberId = createTagDto.getMemberId();
        Long parentTagId = createTagDto.getParentTagId();
        return ResponseEntity.ok(tagService.createTag(tagName, memberId, parentTagId));
    }

    @PutMapping("/{tagId}/updateParent")
    public ResponseEntity<Long> updateParentTag(@PathVariable Long tagId, @RequestBody UpdateParentTagDto updateParentTagDto) {
//        Long tagId = updateParentTagDto.getTagId();
        Long newParentTagId = updateParentTagDto.getNewParentTagId();
        return ResponseEntity.ok(tagService.updateParentTag(tagId, newParentTagId));
    }
}
