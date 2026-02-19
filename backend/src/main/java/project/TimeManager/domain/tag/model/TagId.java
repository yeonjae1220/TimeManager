package project.TimeManager.domain.tag.model;

public record TagId(Long value) {
    public static TagId of(Long value) {
        return new TagId(value);
    }
}
