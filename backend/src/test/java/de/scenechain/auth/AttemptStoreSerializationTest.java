package de.scenechain.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import tools.jackson.databind.ObjectMapper;
import de.scenechain.config.SceneChainProperties;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.jackson.autoconfigure.JacksonAutoConfiguration;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

class AttemptStoreSerializationTest {
    private final ApplicationContextRunner context = new ApplicationContextRunner()
        .withInitializer(new ConfigDataApplicationContextInitializer())
        .withConfiguration(AutoConfigurations.of(JacksonAutoConfiguration.class));
    private final SceneChainProperties properties = new SceneChainProperties(false, 300, 3600,
        new SceneChainProperties.Keys("pepper", "metadata", "lookup", "synthetic"));
    private static final UUID ACCOUNT = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String ENROLLMENT = """
        {"accountId":"00000000-0000-0000-0000-000000000001","handle":"fixture-handle",
         "csrf":"fixture-csrf","sceneIds":[1001,1002],"consentedAt":"2026-10-22T01:00:00Z",
         "confirmationTag":"fixture-tag","matchingConfirmations":2}
        """;

    @Test
    @SuppressWarnings("unchecked")
    void preservesExistingEnrollmentJsonAndTtlWithTheConfiguredMapper() {
        context.run(application -> {
            var mapper = application.getBean(ObjectMapper.class);
            var redis = mock(StringRedisTemplate.class);
            ValueOperations<String, String> values = mock(ValueOperations.class);
            when(redis.opsForValue()).thenReturn(values);
            when(values.get("enrollment:fixture")).thenReturn(ENROLLMENT);
            var store = new AttemptStore(redis, mapper, properties);
            var enrollment = new AttemptStore.Enrollment(ACCOUNT, "fixture-handle", "fixture-csrf",
                List.of(1001, 1002), OffsetDateTime.parse("2026-10-22T01:00:00Z"), "fixture-tag", 2);
            assertThat(store.getEnrollment("fixture")).isEqualTo(enrollment);
            store.putEnrollment("fixture", enrollment);
            var written = ArgumentCaptor.forClass(String.class);
            verify(values).set(eq("enrollment:fixture"), written.capture(), eq(Duration.ofSeconds(300)));
            assertThat(mapper.readTree(written.getValue())).isEqualTo(mapper.readTree(ENROLLMENT));
        });
    }

    @Test
    @SuppressWarnings("unchecked")
    void consumesExistingAttemptsOnceAndRejectsInvalidStoredJson() {
        context.run(application -> {
            var redis = mock(StringRedisTemplate.class);
            ValueOperations<String, String> values = mock(ValueOperations.class);
            when(redis.opsForValue()).thenReturn(values);
            when(values.getAndDelete("attempt:fixture")).thenReturn("""
                {"keyedHandle":"fixture","accountId":"00000000-0000-0000-0000-000000000001",
                 "known":true,"mode":"login","csrf":"fixture-csrf","sceneIds":[1001],
                 "publicSceneIds":[1002],"overlays":[[1,2]],"startedAtMillis":12345}
                """);
            when(values.get("enrollment:invalid")).thenReturn("{invalid");
            var store = new AttemptStore(redis, application.getBean(ObjectMapper.class), properties);
            assertThat(store.consumeAttempt("fixture")).isEqualTo(new AttemptStore.Attempt(
                "fixture", ACCOUNT, true, "login", "fixture-csrf", List.of(1001), List.of(1002),
                List.of(List.of(1, 2)), 12345));
            verify(values).getAndDelete("attempt:fixture");
            assertThat(store.getEnrollment("invalid")).isNull();
            assertThat(store.getEnrollment("absent")).isNull();
        });
    }
}
