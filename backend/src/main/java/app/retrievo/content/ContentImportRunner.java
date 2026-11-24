package app.retrievo.content;

import app.retrievo.content.file.ContentSetValidator;
import app.retrievo.content.file.ContentValidationException;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * 시작할 때 retrievo.content.import-dir 아래의 문제 파일(*.yaml)을 모두 가져온다.
 * 예: 배포 시 dev-lessons의 content/questions를 내려받아 이 경로로 넘긴다.
 * 먼저 모든 파일을 콘텐츠 저장소 CI와 같은 규칙(ContentSetValidator)으로 검사하고,
 * 오류가 하나라도 있으면 아무것도 가져오지 않고 시작을 멈춘다 (틀린 문제가 조용히 빠지지 않게).
 *
 * 웹 서버가 요청을 받기 전에 끝낸다 (SmartInitializingSingleton: 빈이 모두 만들어진 뒤, 서버가 포트를 열기 전).
 * 전에는 서버가 뜬 뒤에(ApplicationRunner) 가져왔다. Cloud Run은 포트가 열리면 시작이 끝난 것으로 보고,
 * 요청이 없을 때는 CPU를 주지 않는다. 그래서 배포가 끝난 뒤에도 가져오기가 몇 분씩 이어졌고,
 * 그동안 옛 문제가 보였다.
 */
@Component
@ConditionalOnProperty(name = "retrievo.content.import-dir")
public class ContentImportRunner implements SmartInitializingSingleton {

    private static final Logger log = LoggerFactory.getLogger(ContentImportRunner.class);

    private final ContentImporter importer;
    private final Path dir;

    public ContentImportRunner(ContentImporter importer, @Value("${retrievo.content.import-dir}") String dir) {
        this.importer = importer;
        this.dir = Path.of(dir);
    }

    @Override
    public void afterSingletonsInstantiated() {
        try {
            long started = System.currentTimeMillis();
            importAll();
            log.info("문제 가져오기를 마쳤다: {}ms", System.currentTimeMillis() - started);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private void importAll() throws IOException {
        List<Path> files = ContentSetValidator.findFiles(dir);
        if (files.isEmpty()) {
            log.warn("문제 파일이 없다: {}", dir);
            return;
        }

        ContentSetValidator.Result check = ContentSetValidator.validateDirectory(dir);
        if (check.hasErrors()) {
            List<String> errors = new ArrayList<>();
            check.files().forEach(f -> f.errors().forEach(e -> errors.add(f.source() + ": " + e)));
            throw new ContentValidationException(dir.toString(), errors);
        }

        for (Path file : files) {
            String source = dir.relativize(file).toString().replace('\\', '/');
            ImportReport report = importer.importYaml(source, Files.readString(file));
            log.info("문제 가져오기 {}: 새 문제 {}, 새 버전 {}, 그대로 {}, 숨김 {}",
                    report.source(), report.created(), report.newVersions(), report.unchanged(), report.hidden());
            report.warnings().forEach(w -> log.warn("{}: {}", report.source(), w));
        }
    }
}
