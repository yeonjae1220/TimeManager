package project.TimeManager.domain.tag.model;

public enum TagType {
    ROOT, DISCARDED, CUSTOM;

    public boolean stopsCascade() {
        return this == ROOT || this == DISCARDED;
    }
}
