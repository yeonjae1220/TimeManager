package project.TimeManager.controller;

import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class WebErrorController implements ErrorController {
    @GetMapping({"/", "/error"})
    public String redirectRoot() {
        return "forward:/index.html"; // springboot가 정적파일을 직접 제공
    }

    public String getErrorPath() {
        return "/error";
    }

}
