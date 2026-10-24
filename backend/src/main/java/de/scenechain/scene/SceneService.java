package de.scenechain.scene;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import de.scenechain.crypto.CredentialCrypto;
import java.nio.ByteBuffer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class SceneService {
    public record Scene(int id, int version, String family, String title, String asset,
                        String thumbnail, String license, String sourceUrl,
                        Set<Integer> eligibleCells, Set<Integer> recommendedCells) {}
    public record AssignedScene(Scene scene, int windowColumn, int windowRow) {}

    private final CredentialCrypto crypto;
    private final List<Scene> scenes;
    private final String packMode;
    private final String packStatus;
    private final String manifestSha256;

    public SceneService(CredentialCrypto crypto, ObjectMapper mapper,
                        @Value("${scenechain.pack-manifest:}") String manifestPath,
                        @Value("${scenechain.pack-sha256:}") String expectedManifestSha256) {
        this.crypto = crypto;
        String actualSha = manifestHash(manifestPath);
        List<Scene> formal = expectedManifestSha256.equals(actualSha)
            ? loadApprovedPack(mapper, manifestPath) : List.of();
        this.scenes = formal.isEmpty() ? developmentScenes() : formal;
        this.packMode = formal.isEmpty() ? "development" : "formal";
        this.packStatus = formal.isEmpty()
            ? (manifestPath.isBlank() ? "no formal manifest configured" : "formal pack failed pinned hash or asset verification")
            : "approved pack loaded";
        this.manifestSha256 = actualSha;
    }

    private List<Scene> developmentScenes() {
        return List.of(
            scene(1001, "urban", "Berlin courtyard", "/scenes/urban.svg"),
            scene(1002, "workshop", "Instrument workshop", "/scenes/workshop.svg"),
            scene(1003, "library", "Reading room", "/scenes/library.svg"),
            scene(1004, "garden", "Glasshouse", "/scenes/garden.svg"),
            scene(1005, "kitchen", "Test kitchen", "/scenes/kitchen.svg"),
            scene(1006, "harbor", "Working harbor", "/scenes/harbor.svg"),
            scene(1007, "museum", "Collection room", "/scenes/museum.svg"),
            scene(1008, "market", "Covered market", "/scenes/market.svg")
        );
    }

    private List<Scene> loadApprovedPack(ObjectMapper mapper, String manifestPath) {
        if (manifestPath == null || manifestPath.isBlank()) return List.of();
        try {
            Path path = Path.of(manifestPath).normalize();
            if (!Files.isRegularFile(path)) return List.of();
            JsonNode root = mapper.readTree(path.toFile());
            if (!"approved".equals(root.path("status").asText())) return List.of();
            JsonNode entries = root.path("scenes");
            if (!entries.isArray() || entries.size() != 48) return List.of();
            var loaded = new ArrayList<Scene>(48);
            var familyCounts = new HashMap<String, Integer>();
            var ids = new java.util.HashSet<Integer>();
            for (JsonNode entry : entries) {
                int id = entry.path("sceneId").asInt(-1);
                int version = entry.path("version").asInt(-1);
                String family = entry.path("family").asText("");
                String license = entry.path("source").path("license").asText("");
                if (id <= 0 || version != 1 || family.isBlank() || !"CC0-1.0".equals(license) || !ids.add(id)) return List.of();
                var eligible = new LinkedHashSet<Integer>();
                entry.path("eligibleCells").forEach(cell -> eligible.add(cell.asInt(-1)));
                var recommended = new LinkedHashSet<Integer>();
                entry.path("recommendedCells").forEach(cell -> recommended.add(cell.asInt(-1)));
                if (!validEligibleCells(eligible) || !validRecommendedCells(recommended)) return List.of();
                familyCounts.merge(family, 1, Integer::sum);
                String title = entry.path("title").asText(familyLabel(family, familyCounts.get(family)));
                if (!validAsset(path.getParent(), entry.path("canonical"))
                    || !validAsset(path.getParent(), entry.path("delivery"))
                    || !validAsset(path.getParent(), entry.path("thumbnail"))) return List.of();
                loaded.add(new Scene(id, version, family, title,
                    "/formal-scenes/" + id + ".webp", "/formal-thumbnails/" + id + ".webp", license,
                    entry.path("source").path("url").asText(), Collections.unmodifiableSet(eligible), Collections.unmodifiableSet(recommended)));
            }
            if (familyCounts.size() != 8 || familyCounts.values().stream().anyMatch(count -> count != 6)) return List.of();
            return List.copyOf(loaded);
        } catch (RuntimeException error) {
            return List.of();
        }
    }

    private boolean validEligibleCells(Set<Integer> cells) {
        return cells.size() == 384 && cells.stream().allMatch(cell -> cell >= 0 && cell < 384);
    }

    private boolean validRecommendedCells(Set<Integer> cells) {
        if (cells.size() < 192 || cells.size() > 240 || cells.stream().anyMatch(cell -> cell < 0 || cell >= 384)) return false;
        for (int row = 0; row < 16; row += 4) {
            for (int column = 0; column < 24; column += 6) {
                int count = 0;
                for (int cell : cells) {
                    int cellRow = cell / 24;
                    int cellColumn = cell % 24;
                    if (cellRow >= row && cellRow < row + 4 && cellColumn >= column && cellColumn < column + 6) count++;
                }
                if (count < 12 || count > 15) return false;
            }
        }
        return true;
    }

    private String familyLabel(String family, int number) {
        return family.substring(0, 1).toUpperCase(java.util.Locale.ROOT) + family.substring(1) + " scene " + number;
    }

    private Scene scene(int id, String family, String title, String asset) {
        return new Scene(id, 0, family, title, asset, asset, "DEVELOPMENT-ONLY",
            "local://development-pack", allCells(), eligibleCells());
    }

    private Set<Integer> allCells() {
        var cells = new LinkedHashSet<Integer>();
        for (int cell = 0; cell < 384; cell++) cells.add(cell);
        return Collections.unmodifiableSet(cells);
    }

    private Set<Integer> eligibleCells() {
        var cells = new LinkedHashSet<Integer>();
        for (int windowRow = 0; windowRow < 4; windowRow++) {
            for (int windowCol = 0; windowCol < 4; windowCol++) {
                for (int localRow = 0; localRow < 4; localRow++) {
                    for (int localCol = 0; localCol < 6; localCol++) {
                        if ((localRow * 6 + localCol) % 2 == 0) {
                            int col = windowCol * 6 + localCol;
                            int row = windowRow * 4 + localRow;
                            cells.add(row * 24 + col);
                        }
                    }
                }
            }
        }
        return Collections.unmodifiableSet(cells);
    }

    public List<Scene> all() { return scenes; }
    public List<Scene> shuffledPublicPool() {
        var pool = new ArrayList<>(scenes);
        Collections.shuffle(pool, crypto.random());
        return List.copyOf(pool);
    }
    public String packMode() { return packMode; }
    public String packStatus() { return packStatus; }
    public String manifestSha256() { return manifestSha256; }

    private String manifestHash(String manifestPath) {
        if (manifestPath == null || manifestPath.isBlank()) return "";
        try { return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
            .digest(Files.readAllBytes(Path.of(manifestPath).normalize()))); }
        catch (Exception error) { return ""; }
    }

    private boolean validAsset(Path root, JsonNode asset) {
        try {
            Path file = root.resolve(asset.path("path").asText()).normalize();
            if (!file.startsWith(root.normalize()) || !Files.isRegularFile(file)) return false;
            String actual = java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(Files.readAllBytes(file)));
            return MessageDigest.isEqual(actual.getBytes(java.nio.charset.StandardCharsets.US_ASCII),
                asset.path("sha256").asText().getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        } catch (Exception error) { return false; }
    }

    public Scene get(int id) {
        return scenes.stream().filter(scene -> scene.id() == id).findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Unknown scene"));
    }

    public List<AssignedScene> randomEnrollment() {
        var shuffled = distinctFamilySelection(crypto.random());
        var assigned = new ArrayList<AssignedScene>();
        for (Scene scene : shuffled) {
            int window = crypto.random().nextInt(16);
            assigned.add(new AssignedScene(scene, (window % 4) * 6, (window / 4) * 4));
        }
        return List.copyOf(assigned);
    }

    public List<Scene> synthetic(String normalizedHandle) {
        byte[] seed = crypto.syntheticSeed(normalizedHandle);
        long value = ByteBuffer.wrap(seed).getLong();
        var random = new java.util.Random(value);
        return distinctFamilySelection(random);
    }

    private List<Scene> distinctFamilySelection(java.util.Random random) {
        Map<String, List<Scene>> byFamily = new HashMap<>();
        for (Scene scene : scenes) byFamily.computeIfAbsent(scene.family(), ignored -> new ArrayList<>()).add(scene);
        var families = new ArrayList<>(byFamily.keySet());
        Collections.shuffle(families, random);
        var selected = new ArrayList<Scene>(5);
        for (String family : families.subList(0, 5)) {
            List<Scene> options = byFamily.get(family);
            selected.add(options.get(random.nextInt(options.size())));
        }
        return List.copyOf(selected);
    }

    public boolean eligibleInWindow(int sceneId, int cellId, int windowColumn, int windowRow) {
        Scene scene = get(sceneId);
        int row = cellId / 24;
        int col = cellId % 24;
        return scene.eligibleCells().contains(cellId)
            && col >= windowColumn && col < windowColumn + 6
            && row >= windowRow && row < windowRow + 4;
    }
}
