package project.TimeManager.Service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.dto.TagDto;
import project.TimeManager.entity.Member;
import project.TimeManager.entity.Tag;
import project.TimeManager.entity.TagType;
import project.TimeManager.repository.MemberRepository;
import project.TimeManager.repository.RecordRepository;
import project.TimeManager.repository.TagRepository;

import java.time.Duration;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
@Slf4j
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class TagService {
    private final TagRepository tagRepository;
    private final RecordRepository recordRepository;
    private final MemberRepository memberRepository;

    private final RecordService recordService;

    @Autowired
    private EntityManager em;

    /*
    for admin
     */
    //모든 사용자의 모든 태그 조회
    public List<Tag> findAllTags() {
        return tagRepository.findAll();
    }

    /*
    for customer
     */
    // 타이머 작동
    // 시작 시간 저장 (Start 버튼 눌렀을 때)
    @Transactional
    public Long startStopwatch(Long tagId, ZonedDateTime startTime) {
        Tag tag = tagRepository.findById(tagId)
                .orElseThrow(() -> new RuntimeException("Tag not found"));

        // 실행중인 태그가 있는지 확인, 다른 태그가 실행중이라면, 해당 태그를 정지 후 현재 태그 실행
        // 저장 될지 모르곘음
        List<Tag> tagList = tagRepository.findTagListByMemberId(tag.getMember().getId());
        for (Tag checkTag : tagList) {
            if (checkTag.getState() && !checkTag.getId().equals((tag.getId()))) {
                log.info("실행중이던 태그 정지");
                ZonedDateTime endTime = ZonedDateTime.now(startTime.getZone());
                Long delta = Duration.between(startTime, endTime).getSeconds();
                recordService.stopStopwatch(checkTag.getId(), delta, checkTag.getLatestStartTime(), endTime);
                break;
            }
        }

        tag.startStopwatch(startTime);
        tagRepository.save(tag);
        return tag.getId();
    }

    @Transactional
    public Long resetStopwatch(Long tagId, Long elapsedTime) {
        Tag tag = tagRepository.findById(tagId)
                .orElseThrow(() -> new RuntimeException("Tag not found"));
        tag.resetStopwatch(elapsedTime);
        tagRepository.save(tag);
        return tag.getId();
    }


    // 시작 시간 조회 (다른 기기에서도 확인 가능)
    public ZonedDateTime getStartTime(Long tagId) {
        return tagRepository.findById(tagId)
                .map(Tag::getLatestStartTime)
                .orElse(null);
    }



    // 사용자 특정 tag detail 조회
    public TagDto findOneTagDtoById (Long tagId) {
        return tagRepository.findOneTagDtoById(tagId);
    }

    // 사용자의 모든 Tag 조회
    public List<Tag> findTagListByMemberId(Long memberId) {
        return tagRepository.findTagListByMemberId(memberId);
    }

    public List<TagDto> findTagListDtoByMemberId(Long memberId) {
        List<TagDto> allTags = tagRepository.findTagListDtoByMemberId(memberId);

        // ID로 태그를 매핑하여 빠르게 조회할 수 있도록 Map 생성
        Map<Long, TagDto> tagMap = allTags.stream()
                .collect(Collectors.toMap(TagDto::getId, tag -> tag));

        // 최상위 태그를 담을 리스트
        List<TagDto> rootTags = new ArrayList<>();

        for (TagDto tagDto : allTags) {
            if (tagDto.getType() != TagType.CUSTOM) {
                rootTags.add(tagDto);
            } else {
                // tagMap.get(tagDto.getParentId()).getChildren().add(tagDto);
                // 부모가 있는 태그는 부모의 children에 추가
                TagDto parentTag = tagMap.get(tagDto.getParentId());
                if (parentTag != null) {
                    parentTag.getChildren().add(tagDto);
                }
            }
        }

        return rootTags;
    }

    @Transactional
    public Long createTag(String tagName, Long memberId, Long parentTagId) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new EntityNotFoundException("Member not found"));

        Tag parentTag = tagRepository.findById(parentTagId)
                .orElseThrow(() -> new EntityNotFoundException("ParentTag not found"));

        Tag tag = new Tag(tagName, member, parentTag);
        tagRepository.save(tag);
        log.info("tag id : " + tag.getId());
        return tag.getId();
    }

    /*
    updateParent
     */


    /*
    deleteTag
     */
    // 쓰래기 통 태그 아이디 자체를 받아오는게 좋지 않나?
    @Transactional
    public Long updateParentTag(Long tagId, Long newParentTagId) {
        Tag deleteTag = tagRepository.findById(tagId)
                .orElseThrow(() -> new EntityNotFoundException("Tag not found"));

        Tag parentTag = deleteTag.getParent();

        // 쓰래기 통 루트랑 연결 해야함
//        Tag discardedTag = tagRepository.findByTypeAndMember(TagType.DISCARDED, member)
//                .orElseThrow(() -> new EntityNotFoundException("Discarded tag not found"));

        Tag newParentTag = tagRepository.findById(newParentTagId)
                .orElseThrow(() -> new EntityNotFoundException("Tag not found"));


        moveTagAndUpdateTime(parentTag, deleteTag, newParentTag);

        return tagId;
    }

    // 🔹 중복된 태그 이동 및 시간 업데이트 로직을 별도 메서드로 분리

    private void moveTagAndUpdateTime(Tag parentTag, Tag deleteTag, Tag discardedTag) {
        parentTag.moveChildTag(deleteTag, discardedTag);

        log.info("Before update - parentTag totalTime: " + parentTag.getTotalTime());
        log.info("Before update - discardedTag totalTime: " + discardedTag.getTotalTime());
        log.info("Before update - deleteTag totalTime: " + deleteTag.getTotalTime());

        // 삭제한 태그의 시간을 부모 태그에서 차감 (root까지 갱신)
        recordService.updateTagTimeBatch(parentTag, -deleteTag.getTotalTime());

        // 새 부모(discardedTag)의 totalTime 업데이트
        recordService.updateTagTimeBatch(discardedTag, deleteTag.getTotalTime());

        // 2. 강제 새로고침 (DB에서 다시 조회) // 이거 하니까 잘 나온다. 근데 service 계층에서 entityManager까지 떙겨와서 쓸 필요가 있나?
        parentTag = em.find(Tag.class, parentTag.getId());
        deleteTag = em.find(Tag.class, deleteTag.getId());
        discardedTag = em.find(Tag.class, discardedTag.getId());

        log.info("After update - parentTag totalTime: " + parentTag.getTotalTime());
        log.info("After update - discardedTag totalTime: " + discardedTag.getTotalTime());
        log.info("After update - deleteTag totalTime: " + deleteTag.getTotalTime());

        // 변경된 태그 저장
        tagRepository.save(deleteTag);
        tagRepository.save(parentTag);
        tagRepository.save(discardedTag);
    }

}
