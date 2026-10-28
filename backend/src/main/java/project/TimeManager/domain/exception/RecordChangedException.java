package project.TimeManager.domain.exception;

/** A conditional edit must not silently replace another device's changes. */
public class RecordChangedException extends RuntimeException {}
