package project.TimeManager.adapter.in.web;

import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class WebErrorController implements ErrorController {

    @GetMapping({"/", "/error"})
    public String redirectRoot() {
        return "forward:/index.html";
    }
}
