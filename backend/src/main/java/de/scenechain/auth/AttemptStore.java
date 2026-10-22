package de.scenechain.auth;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import de.scenechain.config.SceneChainProperties;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class AttemptStore {
    public record Attempt(String keyedHandle, UUID accountId, boolean known, String mode,
                          String csrf, List<Integer> sceneIds, List<Integer> publicSceneIds,
                          List<List<Integer>> overlays, long startedAtMillis) {}
    public record Enrollment(UUID accountId, String handle, String csrf, List<Integer> sceneIds,
                             java.time.OffsetDateTime consentedAt, String confirmationTag,
                             int matchingConfirmations) {}

    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;
    private final Duration ttl;

    public AttemptStore(StringRedisTemplate redis, ObjectMapper mapper, SceneChainProperties properties) {
        this.redis = redis;
        this.mapper = mapper;
        this.ttl = Duration.ofSeconds(properties.attemptTtlSeconds());
    }

    public void putAttempt(String id, Attempt value) { put("attempt:" + id, value); }
    public Attempt consumeAttempt(String id) { return consume("attempt:" + id, Attempt.class); }
    public void putEnrollment(String id, Enrollment value) { put("enrollment:" + id, value); }
    public Enrollment getEnrollment(String id) { return get("enrollment:" + id, Enrollment.class); }
    public Enrollment consumeEnrollment(String id) { return consume("enrollment:" + id, Enrollment.class); }

    private void put(String key, Object value) {
        try {
            redis.opsForValue().set(key, mapper.writeValueAsString(value), ttl);
        } catch (JacksonException e) {
            throw new IllegalStateException(e);
        }
    }

    private <T> T consume(String key, Class<T> type) {
        String value = redis.opsForValue().getAndDelete(key);
        return read(value, type);
    }

    private <T> T get(String key, Class<T> type) {
        return read(redis.opsForValue().get(key), type);
    }

    private <T> T read(String value, Class<T> type) {
        if (value == null) return null;
        try {
            return mapper.readValue(value, type);
        } catch (JacksonException e) {
            return null;
        }
    }
}
