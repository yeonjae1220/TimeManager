package project.TimeManager.entity;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class TagTest {
    @Autowired
    EntityManager em;

    @Test
    public void EntitySetParentChild() {

        Tag tag1 = new Tag("tag1");
        Tag tag2 = new Tag("tag2");
        Tag tag1_1 = new Tag("tag1_1", tag1);

        em.persist(tag1);
        em.persist(tag2);
        em.persist(tag1_1);

        assertThat(tag1.getChildren()).containsExactly(tag1_1);
        assertThat(tag1_1.getParent()).isEqualTo(tag1);
    }

}