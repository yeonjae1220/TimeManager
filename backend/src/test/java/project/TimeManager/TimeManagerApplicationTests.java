package project.TimeManager;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class TimeManagerApplicationTests {

	@Autowired
	// @PersistenceContext 스프링 프레임워크 말고 다른걸 사용 할 수 있다면 이걸 쓰고, 아님 뭐 autowired 사용
	EntityManager em;

	//	@Test
//	void contextLoads() {
//		Hello hello = new Hello();
//		em.persist(hello);
//
//		JPAQueryFactory query = new JPAQueryFactory(em);
//		// QHello qHello = new QHello("h");
//		QHello qHello = QHello.hello;
//
//		Hello result = query
//				.selectFrom(qHello)
//				.fetchOne();
//
//		assertThat(result).isEqualTo(hello);
//		//lombok check
//		assertThat(result.getId()).isEqualTo(hello.getId());
//	}

}
