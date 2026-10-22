package de.scenechain.protocol;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.HexFormat;
import java.util.List;
import tools.jackson.databind.json.JsonMapper;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class ProtocolTest {
    private final List<Protocol.Stage> vector = List.of(
        new Protocol.Stage(1001, 0, 0),
        new Protocol.Stage(1002, 77, 1),
        new Protocol.Stage(1003, 191, 2),
        new Protocol.Stage(1004, 255, 3),
        new Protocol.Stage(1005, 383, 0)
    );

    @Test
    void encodesPublishedVector() throws Exception {
        byte[] encoded = Protocol.encode(vector);
        var published = JsonMapper.builder().build().readTree(Path.of("../protocol/test-vectors/credential-v1.json").toFile());
        assertThat(encoded).hasSize(39);
        assertThat(HexFormat.of().formatHex(encoded))
            .isEqualTo(published.path("encodedHex").asText());
        assertThat(published.path("encodedLength").asInt()).isEqualTo(encoded.length);
        assertThat(Protocol.decode(encoded)).isEqualTo(vector);
    }

    @Test
    void quantizesEdgesWithoutOverflow() {
        assertThat(Protocol.quantize(0, 0)).isZero();
        assertThat(Protocol.quantize(65535, 65535)).isEqualTo(383);
        assertThat(Protocol.quantize(32768, 32768)).isEqualTo(204);
        assertThatThrownBy(() -> Protocol.quantize(65536, 0)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsOutOfRangeCredentialMaterial() {
        assertThatThrownBy(() -> new Protocol.Stage(1, -1, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Protocol.Stage(1, 384, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Protocol.Stage(1, 0, 4)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Protocol.decode(new byte[39])).isInstanceOf(IllegalArgumentException.class);
    }
}
