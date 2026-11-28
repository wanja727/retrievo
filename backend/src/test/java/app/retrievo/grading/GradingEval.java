package app.retrievo.grading;

import app.retrievo.content.file.ContentFile;
import app.retrievo.content.file.ContentFile.CoreQuestionDef;
import app.retrievo.content.file.ContentFileParser;
import app.retrievo.grading.AnswerGrader.Grade;
import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/**
 * 채점 품질을 잰다 (명령줄). 사람이 포인트마다 판정을 정해 둔 답 세트를 모델에 채점시키고 얼마나 맞는지 센다.
 * 프롬프트(GradingPrompt)나 포인트를 쓰는 기준을 바꾸면 다시 돌린다.
 *
 * <pre>./gradlew gradeEval -PcontentDir=../../dev-lessons/content/questions -Pmodels=claude-haiku-5-5,claude-sonnet-5-5</pre>
 *
 * 결과는 build/grading-eval/report.txt에도 남는다.
 * ANTHROPIC_API_KEY가 없으면 답 세트가 문제 파일과 맞는지만 확인하고 끝난다.
 * 모델을 부르면 돈이 든다. 답 100개쯤에 Haiku로 수십 원, Sonnet으로 몇백 원이다.
 */
public final class GradingEval {

    private static final List<String> SETS = List.of("grading-eval/oop.yaml");
    private static final int THREADS = 4;

    /** 100만 토큰당 달러 (입력, 출력). 2026-11 기준 */
    private static final Map<String, double[]> PRICES = Map.of(
            "claude-haiku-5-5", new double[] {0.10, 0.50},
            "claude-sonnet-5-5", new double[] {2.00, 10.00});
    private static final double WON_PER_DOLLAR = 1400;

    private GradingEval() {
    }

    record EvalQuestion(String lesson, String question, List<EvalCase> cases) {
    }

    record EvalCase(String kind, String note, String answer, List<Boolean> expect) {
    }

    /** 채점할 답 하나 */
    record Item(String id, String kind, String question, List<String> points, String answer, List<Boolean> expect) {
    }

    record Outcome(Item item, Grade grade, String error) {
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("사용법: GradingEval <문제 파일 디렉터리> <모델,모델...>");
            System.exit(2);
        }
        tee(Path.of("build", "grading-eval", "report.txt"));
        List<Item> items = load(Path.of(args[0]));
        long points = items.stream().mapToLong(i -> i.points().size()).sum();
        System.out.printf("답 %d개, 포인트 판정 %d개%n", items.size(), points);

        if (System.getenv("ANTHROPIC_API_KEY") == null) {
            System.out.println("ANTHROPIC_API_KEY가 없어서 답 세트만 확인하고 끝낸다.");
            return;
        }
        AnthropicClient client = AnthropicOkHttpClient.fromEnv();
        for (String model : args[1].split(",")) {
            report(model.strip(), run(new ClaudeAnswerGrader(client, model.strip()), items));
        }
        System.exit(0);
    }

    /** 결과를 파일에도 남긴다. 콘솔이 한글을 깨뜨리는 환경이 있어서 파일은 UTF-8로 쓴다 */
    private static void tee(Path report) throws IOException {
        Files.createDirectories(report.getParent());
        PrintStream console = System.out;
        OutputStream file = Files.newOutputStream(report);
        System.setOut(new PrintStream(new OutputStream() {
            @Override
            public void write(int b) throws IOException {
                console.write(b);
                file.write(b);
            }

            @Override
            public void flush() throws IOException {
                console.flush();
                file.flush();
            }
        }, true, StandardCharsets.UTF_8));
    }

    /** 답 세트를 읽고 문제 파일의 포인트와 맞춘다. 개수가 다르면 멈춘다 */
    static List<Item> load(Path contentDir) throws IOException {
        YAMLMapper yaml = new YAMLMapper();
        Map<String, ContentFile> files = new HashMap<>();
        List<Item> items = new ArrayList<>();
        for (String set : SETS) {
            List<EvalQuestion> questions;
            try (InputStream in = GradingEval.class.getClassLoader().getResourceAsStream(set)) {
                questions = yaml.readValue(in, new TypeReference<>() {
                });
            }
            for (EvalQuestion q : questions) {
                ContentFile file = files.computeIfAbsent(q.lesson(), lesson -> read(contentDir, lesson));
                CoreQuestionDef core = file.coreQuestions().stream()
                        .filter(c -> c.key().equals(q.question()))
                        .findFirst()
                        .orElseThrow(() -> new IllegalStateException(q.lesson() + "/" + q.question() + ": 핵심 질문이 없다"));
                if (core.points() == null) {
                    throw new IllegalStateException(q.lesson() + "/" + q.question() + ": 포인트가 없다");
                }
                for (int i = 0; i < q.cases().size(); i++) {
                    EvalCase c = q.cases().get(i);
                    String id = q.lesson() + "/" + q.question() + "#" + (i + 1);
                    if (c.expect().size() != core.points().size()) {
                        throw new IllegalStateException(id + ": expect가 " + c.expect().size() + "개인데 포인트는 "
                                + core.points().size() + "개다");
                    }
                    items.add(new Item(id, c.kind(), core.text(), core.points(), c.answer(), c.expect()));
                }
            }
        }
        return items;
    }

    private static ContentFile read(Path contentDir, String lesson) {
        Path path = contentDir.resolve(lesson + ".yaml");
        try {
            return ContentFileParser.parse(path.toString(), Files.readString(path, StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new IllegalStateException("문제 파일을 읽을 수 없다: " + path, e);
        }
    }

    private static List<Outcome> run(AnswerGrader grader, List<Item> items) throws Exception {
        List<Outcome> outcomes = new ArrayList<>();
        try (ExecutorService pool = Executors.newFixedThreadPool(THREADS)) {
            List<Future<Outcome>> futures = new ArrayList<>();
            for (Item item : items) {
                futures.add(pool.submit(() -> {
                    try {
                        return new Outcome(item, grader.grade(item.question(), item.points(), item.answer()), null);
                    } catch (RuntimeException e) {
                        return new Outcome(item, null, e.getMessage());
                    }
                }));
            }
            for (Future<Outcome> future : futures) {
                outcomes.add(future.get());
            }
        }
        return outcomes;
    }

    private static void report(String model, List<Outcome> outcomes) {
        int judged = 0;
        int agreed = 0;
        int falsePass = 0; // 빠진 포인트를 들어 있다고 했다. 모르는데 안다고 믿게 해서 더 나쁘다
        int falseFail = 0; // 들어 있는 포인트를 빠졌다고 했다
        int answers = 0;
        int answersAgreed = 0;
        int failed = 0;
        long inputTokens = 0;
        long outputTokens = 0;
        List<Long> millis = new ArrayList<>();
        List<String> misses = new ArrayList<>();

        for (Outcome o : outcomes) {
            if (o.grade() == null) {
                failed++;
                misses.add("  실패 " + o.item().id() + ": " + o.error());
                continue;
            }
            Grade grade = o.grade();
            inputTokens += grade.usage().inputTokens();
            outputTokens += grade.usage().outputTokens();
            millis.add(grade.usage().millis());
            answers++;
            boolean expectPass = o.item().expect().stream().allMatch(Boolean::booleanValue);
            if (expectPass == grade.passed()) {
                answersAgreed++;
            }
            for (int i = 0; i < o.item().points().size(); i++) {
                boolean expect = o.item().expect().get(i);
                boolean got = grade.results().get(i).included();
                judged++;
                if (expect == got) {
                    agreed++;
                    continue;
                }
                if (got) {
                    falsePass++;
                } else {
                    falseFail++;
                }
                misses.add("  " + (got ? "잘못 통과" : "잘못 탈락") + " " + o.item().id() + " [" + o.item().kind() + "] 포인트 "
                        + (i + 1) + ": " + o.item().points().get(i)
                        + "\n      답: " + o.item().answer()
                        + "\n      모델: " + grade.results().get(i).comment());
            }
        }

        millis.sort(Comparator.naturalOrder());
        System.out.println();
        System.out.println("== " + model + " ==");
        System.out.printf("포인트 판정 일치 %d/%d (%.1f%%), 잘못 통과 %d, 잘못 탈락 %d%n",
                agreed, judged, percent(agreed, judged), falsePass, falseFail);
        System.out.printf("답 단위 통과 여부 일치 %d/%d (%.1f%%), 호출 실패 %d%n",
                answersAgreed, answers, percent(answersAgreed, answers), failed);
        if (!millis.isEmpty()) {
            System.out.printf("응답 시간 중앙값 %dms, 90%% %dms, 최대 %dms%n",
                    millis.get(millis.size() / 2), millis.get(millis.size() * 9 / 10), millis.get(millis.size() - 1));
        }
        double[] price = PRICES.get(model);
        if (price != null && answers > 0) {
            double won = (inputTokens * price[0] + outputTokens * price[1]) / 1_000_000 * WON_PER_DOLLAR;
            System.out.printf("토큰 입력 %d, 출력 %d. 모두 약 %.0f원, 답 하나에 약 %.2f원%n",
                    inputTokens, outputTokens, won, won / answers);
        } else {
            System.out.printf("토큰 입력 %d, 출력 %d%n", inputTokens, outputTokens);
        }
        misses.forEach(System.out::println);
    }

    private static double percent(int part, int whole) {
        return whole == 0 ? 0 : 100.0 * part / whole;
    }
}
