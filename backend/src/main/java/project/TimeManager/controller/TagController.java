package project.TimeManager.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Controller;
import project.TimeManager.repository.TagRepository;

@Controller
@RequiredArgsConstructor
@Slf4j
public class TagController {

    private final TagRepository tagRepository;

//    @PostConstruct
//    public void init() {
//        tagRepository.save(new Tag("tag1"));
//        tagRepository.save(new Tag("tag2"));
//        tagRepository.save(new Tag("tag1-1"));
//    }

}
