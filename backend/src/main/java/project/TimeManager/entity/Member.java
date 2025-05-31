package project.TimeManager.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.util.ArrayList;
import java.util.List;

import static project.TimeManager.entity.TagType.DISCARDED;
import static project.TimeManager.entity.TagType.ROOT;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@ToString(of = {"id", "name"})
public class Member {

    @Id
    @GeneratedValue
    @Column(name = "member_id")
    private Long id;
    private String name;

    //@OneToMany(mappedBy = "member")
    @OneToMany(mappedBy = "member", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Tag> tagList = new ArrayList<>();

    public Member(String name) {
        this.name = name;
    }

    public void addTag(Tag tag) {
        this.tagList.add(tag);
    }

    // @PostPersist // 엔티티가 저장된 후 자동 실행
    @PrePersist
    public void initializeDefaultTags() {
        System.out.println("Initializing default tags for member: " + this.name);
        Tag rootTag = new Tag("root", this, ROOT);
        rootTag.updateParentTag(rootTag);
        Tag discardedTag = new Tag("discarded", this, rootTag, DISCARDED);
    }


    /* For test */
    public Member(String name, Tag tag) {
        this.name = name;
        this.tagList.add(tag);
    }
    /* For test */
    public Member(Tag tag) {
        this.tagList.add(tag);
    }


}

/*


 */