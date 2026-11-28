package app.retrievo.content.file;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.ClassPathResource;

/** 스프링 없이 도는 검사기 테스트. 콘텐츠 저장소 CI의 checkContent가 이 규칙을 쓴다 */
class ContentSetValidatorTest {

    private static final String LINE_PICK = """
            subject: {key: dev, name: 개발자 면접}
            lesson: {key: sync, title: 동기화, unit: 동시성, order: 9}
            concepts:
              - {key: race, name: 경쟁 상태}
            questions:
              - key: race-lines
                concept: race
                type: line_pick
                status: reviewed
                difficulty: 2
                body: 경쟁 상태가 생기는 줄을 모두 고르세요
                code: |
                  public String issue() {
                      if (issuedCount >= 100) return "마감";
                      issuedCount++;
                      return "발급";
                  }
                answer: "3, 2"
                explanation: 확인과 증가 사이에 다른 스레드가 끼어든다
                source: https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html
            """;

    @Test
    void 정상_파일들은_오류가_없다() throws IOException {
        ContentSetValidator.Result result = ContentSetValidator.validate(Map.of(
                "n-plus-1.yaml", fixture(),
                "sync.yaml", LINE_PICK));

        assertThat(result.hasErrors()).isFalse();
        assertThat(result.questionCount()).isEqualTo(5);
    }

    @Test
    void 레슨_본문이_있으면_일곱_단계를_모두_검사한다() throws IOException {
        String withSteps = fixture() + steps();
        assertThat(ContentSetValidator.validate(Map.of("ok.yaml", withSteps)).hasErrors()).isFalse();

        String broken = withSteps
                .replace("      prompt: 왜 그대로일까요?\n", "")
                .replaceAll("(?s)  interview:.*", "")
                .replace("    answer: 2\n  background:", "    answer: 5\n  background:");
        ContentSetValidator.FileResult result = ContentSetValidator.validate(Map.of("broken.yaml", broken))
                .files().get(0);

        assertThat(result.errors()).contains(
                "steps.predict: answer는 보기 번호(1~2)다. 지금 값: 5",
                "steps.pitfall.recall.prompt가 비어 있다",
                "steps.interview가 없다");
    }

    @Test
    void 같은_레슨이_두_파일에_있으면_오류다() throws IOException {
        Map<String, String> sources = new LinkedHashMap<>();
        sources.put("a.yaml", fixture());
        sources.put("b.yaml", fixture());

        ContentSetValidator.Result result = ContentSetValidator.validate(sources);

        assertThat(result.files().get(0).errors()).isEmpty();
        assertThat(result.files().get(1).errors())
                .anyMatch(e -> e.contains("dev/n-plus-1") && e.contains("a.yaml"));
    }

    @Test
    void 같은_주제의_이름이_파일마다_다르면_오류다() throws IOException {
        Map<String, String> sources = new LinkedHashMap<>();
        sources.put("a.yaml", fixture());
        sources.put("b.yaml", LINE_PICK.replace("name: 개발자 면접", "name: 개발"));

        assertThat(ContentSetValidator.validate(sources).files().get(1).errors())
                .anyMatch(e -> e.contains("주제 'dev'의 이름"));
    }

    @Test
    void 줄_고르기는_코드의_줄_번호_범위를_검사한다() {
        String outOfRange = LINE_PICK.replace("answer: \"3, 2\"", "answer: \"3, 6\"");
        String noCode = LINE_PICK.replaceAll("(?s)    code: \\|.*?(?=    answer)", "");

        assertThat(errors(outOfRange)).anyMatch(e -> e.contains("줄 번호(1~5)"));
        assertThat(errors(noCode)).anyMatch(e -> e.contains("code가 필요하다"));
    }

    @Test
    void 핵심_질문을_적은_파일은_모든_문제가_그중_하나에_묶여야_한다() {
        String linked = LINE_PICK
                .replace("questions:\n", "coreQuestions:\n  - {key: q1, text: 경쟁 상태가 생기는 이유}\nquestions:\n")
                .replace("    concept: race\n", "    concept: race\n    coreQuestion: q1\n");
        assertThat(errors(linked)).isEmpty();
        assertThat(errors(linked.replace("coreQuestion: q1", "coreQuestion: all"))).isEmpty();

        assertThat(errors(linked.replace("    coreQuestion: q1\n", "")))
                .anyMatch(e -> e.contains("coreQuestion이 없다"));
        assertThat(errors(linked.replace("coreQuestion: q1", "coreQuestion: q9")))
                .anyMatch(e -> e.contains("'q9'가 coreQuestions에 없다"));
        assertThat(errors(linked.replace("{key: q1,", "{key: all,")))
                .anyMatch(e -> e.contains("키로 쓸 수 없다"));
        assertThat(errors(linked.replace("  - {key: q1, text: 경쟁 상태가 생기는 이유}\n",
                "  - {key: q1, text: 경쟁 상태가 생기는 이유}\n  - {key: q1, text: 막는 방법}\n")))
                .anyMatch(e -> e.contains("핵심 질문 키 'q1'가 중복이다"));
    }

    @Test
    void 핵심_질문의_모범_답과_포인트는_함께_적고_포인트는_1개에서_4개다() {
        String base = LINE_PICK
                .replace("questions:\n", "coreQuestions:\n  - key: q1\n    text: 경쟁 상태가 생기는 이유\nANSWER"
                        + "questions:\n")
                .replace("    concept: race\n", "    concept: race\n    coreQuestion: q1\n");
        String answer = "    answer: 읽고 쓰는 사이에 다른 스레드가 끼어들기 때문이에요.\n";

        assertThat(errors(base.replace("ANSWER", ""))).isEmpty();
        assertThat(errors(base.replace("ANSWER", answer + "    points: [읽기와 쓰기가 한 동작이 아니에요, 그 사이에 끼어들어요]\n")))
                .isEmpty();

        assertThat(errors(base.replace("ANSWER", answer)))
                .anyMatch(e -> e.contains("answer와 points는 함께 적는다"));
        assertThat(errors(base.replace("ANSWER", answer + "    points: []\n")))
                .anyMatch(e -> e.contains("points가 0개다"));
        assertThat(errors(base.replace("ANSWER", answer + "    points: [하나, 둘, 셋, 넷, 다섯]\n")))
                .anyMatch(e -> e.contains("points가 5개다"));
    }

    @Test
    void 핵심_질문이_없는_파일은_문제에_coreQuestion을_쓸_수_없다() {
        assertThat(errors(LINE_PICK)).isEmpty();
        assertThat(errors(LINE_PICK.replace("    concept: race\n", "    concept: race\n    coreQuestion: q1\n")))
                .anyMatch(e -> e.contains("coreQuestions가 있어야 한다"));
    }

    @Test
    void 읽을_수_없는_파일도_다른_파일과_함께_결과에_담는다() throws IOException {
        Map<String, String> sources = new LinkedHashMap<>();
        sources.put("broken.yaml", "subject: [");
        sources.put("ok.yaml", fixture());

        ContentSetValidator.Result result = ContentSetValidator.validate(sources);

        assertThat(result.files().get(0).errors()).anyMatch(e -> e.contains("YAML을 읽을 수 없다"));
        assertThat(result.files().get(1).errors()).isEmpty();
    }

    @Test
    void 디렉터리_아래의_yaml_파일을_모두_검사한다(@TempDir Path dir) throws IOException {
        Files.createDirectories(dir.resolve("jpa"));
        Files.writeString(dir.resolve("jpa/n-plus-1.yaml"), fixture(), StandardCharsets.UTF_8);
        Files.writeString(dir.resolve("sync.yml"), LINE_PICK, StandardCharsets.UTF_8);
        Files.writeString(dir.resolve("README.md"), "# 무시", StandardCharsets.UTF_8);

        ContentSetValidator.Result result = ContentSetValidator.validateDirectory(dir);

        assertThat(result.files()).extracting(ContentSetValidator.FileResult::source)
                .containsExactly("jpa/n-plus-1.yaml", "sync.yml");
        assertThat(result.hasErrors()).isFalse();
    }

    private static java.util.List<String> errors(String yaml) {
        return ContentSetValidator.validate(Map.of("x.yaml", yaml)).files().get(0).errors();
    }

    private static String fixture() throws IOException {
        return new ClassPathResource("content/n-plus-1.yaml").getContentAsString(StandardCharsets.UTF_8);
    }

    private static String steps() throws IOException {
        return new ClassPathResource("content-fragments/n-plus-1-steps.yaml").getContentAsString(StandardCharsets.UTF_8);
    }
}
