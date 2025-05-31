package project.TimeManager.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@ToString(of = {"id", "name"})
public class Tag {
    @Id
    @GeneratedValue
    @Column(name = "tag_id")
    private Long id;
    private String name;

    // 초기값으로 CUSTOM을 사용
    @Enumerated(EnumType.STRING)
    private TagType type = TagType.CUSTOM;

    private Long elapsedTime = 0L; // 타이머 시간 용 (reset 안누르는 경우 위해)
    private Long dailyGoalTime = 0L; // 목표 시간
    private Long dailyElapsedTime = 0L; // record 단위의 시간
    private Long dailyTotalTime = 0L; // 하루 총 시간
    private Long tagTotalTime = 0L; // 해당 태그에 투자한 총 시간
    private Long totalTime = 0L; // 해당 태그와 자식 태그를 합친 총 시간
    // private Long maxTime = 0L; // 하루 최장 투자 시간

    private ZonedDateTime latestStartTime = ZonedDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneId.systemDefault()); // 마지막으로 시작한 시간, Stop시 마지막으로 종료한 시간도, 일단 초기화 보단 없으면 화면에서 알려주는걸로
    private ZonedDateTime latestStopTime = ZonedDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneId.systemDefault());

//    @Enumerated(EnumType.STRING)
//    private State state = State.STOP; // 상태 [RUN, STOP]

    private Boolean state = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id")
    private Member member;

    @OneToMany(mappedBy = "tag")
    //@OneToMany(mappedBy = "tag", cascade = CascadeType.ALL)
    private List<Records> records = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private Tag parent;

    // array 동시성?
    @OneToMany(mappedBy = "parent", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Tag> children = new ArrayList<>();



    public Tag(String name) {
        this.name = name;
    }

    public Tag(String name, Tag parentTag) {
        this.name = name;
        this.parent = parentTag;
        parentTag.children.add(this);
    }

    // default rootTag 생성시 초기 사용하는 Tag. 여기서 잠깐 Null이 허용 되긴 하는데 괜찮을까? db에는 안들어 가니 괜찮을 듯
    public Tag(String name, Member member) {
        this.name = name;
        this.member = member;
    }

    public Tag(String name, Member member, Tag parentTag) {
        this.name = name;
        this.member = member;
        this.parent = parentTag;

        member.addTag(this);
        parentTag.children.add(this);
    }

    // 디폴트 태그 생성용 생성자
    public Tag(String name, Member member,TagType type) {
        this.name = name;
        this.member = member;
        this.type = type;

        member.addTag(this);
    }

    public Tag(String name, Member member, Tag parentTag, TagType type) {
        this.name = name;
        this.member = member;
        this.parent = parentTag;
        this.type = type;

        member.addTag(this);
        parentTag.children.add(this);
    }

    // default로 생성되는 rootTag의 parents에 null을 방지하기위해 최상위 태그의 parent를 자기 자신으로 설정.
    public void setRootTagParentItSelf() {
        this.parent = this;
    }

    public void addChildTag(Tag childTag) {
        this.children.add(childTag);
        childTag.parent = this;
    }

//    public void removeTag(Tag tag) {
//
//    }
//
    public void moveChildTag(Tag childTag, Tag newParentTag) {
        childTag.updateParentTag(newParentTag);
        // 변경 감지로 이렇게 안해도 그냥 이동한다?
        // children.remove(childTag); // 이게 문제 tag_id가 RECORDS 테이블의 외래 키(FK) 로 참조되고 있어서 삭제가 차단됨
    }

    public void addChildTagList(List<Tag> children) {
        this.children.addAll(children);
    }

    public void addRecord(Records record) {
        this.records.add(record);
    }

    public void setDailyGoalTime(Long dailyGoalTime) {
        this.dailyTotalTime = dailyGoalTime;
    }

    public void updateTagTotalTime(Long time) {
        this.tagTotalTime += time;
    }

    public void editTagTotalTime(Long delta) {
        this.tagTotalTime += delta;
    }

    public void updateParentTag(Tag parentTag) {
        this.parent = parentTag;
        parentTag.addChildTag(this); // 이런식으로 해도 되나? 모르겠네
    }

    public void removeRecord(Tag childTag) {
        this.records.remove(childTag);
    }

    public void resetStopwatch(Long elapsedTime) {
        this.elapsedTime = elapsedTime;
    }

    public void startStopwatch(ZonedDateTime latestStartTime) {
        this.latestStartTime = latestStartTime;
    }

    public void stopStopwatch(ZonedDateTime latestStopTime) {
        this.latestStopTime = latestStopTime;
    }


    public void saveElapsedTime(Long elapsedTime) {
        this.elapsedTime = elapsedTime;
    }

    public void editDailyTotalTime(Long delta) {
        this.dailyTotalTime += delta;
    }

    public void changeState() {
        this.state = !this.state;
    }

    public void stopState() {
        this.state = false;
    }

    // 리포지토리 안쓰고 이렇게 엔티티에서 꺼내 써도 되나?
    public List<Long> RecordsIdList() {
        List<Long> recordsId = new ArrayList<Long>();
        for (Records record : this.records) {
            recordsId.add(record.getId());
        }
        return recordsId;
    }

    // 리포지토리 안쓰고 이렇게 엔티티에서 꺼내 써도 되나?
    // 얘는 childrenTag Id 리턴해주는거
    public List<Long> ChildrenIdList() {
        List<Long> childrenId = new ArrayList<Long>();
        for (Tag child : this.children) {
            childrenId.add(child.getId());
        }
        return childrenId;
    }

//    @Override
//    public boolean equals(Object o) {
//        if (this == o) return true;
//        if (o == null || getClass() != o.getClass()) return false;
//        Tag tag = (Tag) o;
//        return Objects.equals(id, tag.id);
//    }
//
//    @Override
//    public int hashCode() {
//        return Objects.hash(id);
//    }

    /* For test */
    public Tag(String name, Records record) {
        this.name = name;
        this.records.add(record);
    }

    public Tag(Records record) {
        this.records.add(record);
    }

}
