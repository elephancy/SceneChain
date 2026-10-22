package de.scenechain.scene;

import static org.assertj.core.api.Assertions.assertThat;

import de.scenechain.config.SceneChainProperties;
import de.scenechain.crypto.CredentialCrypto;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.json.JsonMapper;

class ScenePackReadFailureTest {
    @Test
    void invalidJsonWithAMatchingHashNeverBecomesAnApprovedPack(@TempDir Path directory) throws Exception {
        Path manifest = directory.resolve("manifest.json");
        Files.writeString(manifest, "{invalid");
        String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
            .digest(Files.readAllBytes(manifest)));
        var crypto = new CredentialCrypto(new SceneChainProperties(false, 300, 3600,
            new SceneChainProperties.Keys("pepper", "metadata", "lookup", "synthetic")));
        var scenes = new SceneService(crypto, JsonMapper.builder().build(), manifest.toString(), hash);
        assertThat(scenes.packMode()).isEqualTo("development");
        assertThat(scenes.packStatus()).isEqualTo("formal pack failed pinned hash or asset verification");
        assertThat(scenes.manifestSha256()).isEqualTo(hash);
        assertThat(scenes.all()).hasSize(8).allMatch(scene -> scene.version() == 0);
    }
}
