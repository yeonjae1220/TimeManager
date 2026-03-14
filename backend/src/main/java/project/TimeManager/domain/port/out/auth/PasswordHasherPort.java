package project.TimeManager.domain.port.out.auth;

public interface PasswordHasherPort {
    String hash(String raw);
    boolean matches(String raw, String hashed);
}
