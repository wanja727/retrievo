package app.retrievo.learning;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.retrievo.content.ContentImporter;
import app.retrievo.support.IntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * 핵심 루프: 레슨 문제 보기(정답 없이) → 답 내기 → 채점·해설 → 배운 날 판정 문제를 모두 맞히면 지연 확인 예약 (ADR-021)
 * → 3일·7일·21일 뒤 다른 문제로 확인 → 세 번 통과하면 졸업 (ADR-017).
 * 시작 시각은 2026-11-17 10:00 KST (서비스 날짜 2026-11-17).
 */
class LearningLoopTest extends IntegrationTest {

    private static final LocalDate DAY0 = LocalDate.of(2026, 11, 17);

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    ContentImporter importer;

    long userId;
    long lessonId;

    @BeforeEach
    void setUp() throws Exception {
        importer.importYaml("n-plus-1.yaml",
                new ClassPathResource("content/n-plus-1.yaml").getContentAsString(StandardCharsets.UTF_8));
        userId = createUser("tester");
        lessonId = jdbc.queryForObject("select id from lesson where external_key = 'dev/n-plus-1'", Long.class);
    }

    @Test
    void 레슨_목록은_주제를_뺀_레슨_키와_판정_문제_수를_준다() throws Exception {
        JsonNode lessons = getJson("/api/lessons");

        assertThat(lessons).hasSize(1);
        assertThat(lessons.get(0).get("key").asText()).isEqualTo("n-plus-1");
        assertThat(lessons.get(0).get("questionCount").asInt()).isEqualTo(3);
    }

    @Test
    void 레슨_본문이_없으면_steps는_null이고_있으면_일곱_단계를_준다() throws Exception {
        JsonNode before = getJson("/api/lessons/" + lessonId);
        assertThat(before.get("key").asText()).isEqualTo("n-plus-1");
        assertThat(before.get("steps").isNull()).isTrue();

        String withSteps = new ClassPathResource("content/n-plus-1.yaml").getContentAsString(StandardCharsets.UTF_8)
                + new ClassPathResource("content-fragments/n-plus-1-steps.yaml").getContentAsString(StandardCharsets.UTF_8);
        importer.importYaml("n-plus-1.yaml", withSteps);

        JsonNode steps = getJson("/api/lessons/" + lessonId).get("steps");
        assertThat(steps.get("predict").get("answer").asInt()).isEqualTo(2);
        assertThat(steps.get("practice").get("runs")).hasSize(1);
        assertThat(steps.get("interview").get("points")).hasSize(2);
    }

    @Test
    void 레슨_문제에는_정답과_해설이_없다() throws Exception {
        JsonNode questions = getJson("/api/lessons/" + lessonId + "/questions");

        // 판정 문제 3개만 보인다. 서술형(연습)은 자기 채점 화면을 만들 때 연다
        assertThat(questions).hasSize(3);
        for (JsonNode q : questions) {
            assertThat(q.has("answer")).isFalse();
            assertThat(q.has("explanation")).isFalse();
            assertThat(q.has("body")).isTrue();
        }
        assertThat(questions.get(0).get("choices")).hasSize(4);
        assertThat(questions.get(1).get("type").asText()).isEqualTo("OX");
    }

    @Test
    void 답을_내야_정답과_해설을_받는다() throws Exception {
        submit(version("lazy-loop-count"), "4", null).andExpect(status().isOk())
                .andExpect(jsonPath("$.correct").value(true))
                .andExpect(jsonPath("$.answer").value("4"))
                .andExpect(jsonPath("$.explanation").value("팀 목록 1번, 팀마다 members 1번씩 10번. 합쳐서 11번이다."));

        submit(version("lazy-loop-ox"), "o", null).andExpect(status().isOk())
                .andExpect(jsonPath("$.correct").value(false))
                .andExpect(jsonPath("$.selected").value("O"))
                .andExpect(jsonPath("$.answer").value("X"));
    }

    @Test
    void 답을_고르지_않으면_받지_않는다() throws Exception {
        String body = """
                {"clientSubmissionId": "%s", "questionVersionId": %d, "selected": ""}
                """.formatted(UUID.randomUUID(), version("lazy-loop-count"));

        mvc.perform(post("/api/submissions").header("X-Dev-User-Id", userId).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        assertThat(count("answer_submission")).isZero();
    }

    @Test
    void 보기에_없는_번호는_거부한다() throws Exception {
        submit(version("lazy-loop-count"), "5", null).andExpect(status().isBadRequest());
        submit(version("lazy-loop-ox"), "Y", null).andExpect(status().isBadRequest());
        assertThat(count("answer_submission")).isZero();
    }

    @Test
    void 같은_제출을_다시_보내면_처음_결과를_돌려주고_한번만_기록한다() throws Exception {
        UUID clientId = UUID.randomUUID();
        JsonNode first = body(submit(clientId, version("lazy-loop-count"), "4", null));
        // 재시도에 다른 답이 실려 와도 처음 결과를 돌려준다
        JsonNode retry = body(submit(clientId, version("lazy-loop-count"), "1", null));

        assertThat(retry).isEqualTo(first);
        assertThat(count("answer_submission")).isEqualTo(1);
    }

    @Test
    void 같은_제출이_동시에_와도_한번만_기록한다() throws Exception {
        UUID clientId = UUID.randomUUID();
        long versionId = version("lazy-loop-count");
        int threads = 8;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<JsonNode>> results = new ArrayList<>();
        try {
            for (int i = 0; i < threads; i++) {
                Callable<JsonNode> task = () -> {
                    start.await();
                    return body(submit(clientId, versionId, "4", null));
                };
                results.add(pool.submit(task));
            }
            start.countDown();
            List<Long> ids = new ArrayList<>();
            for (Future<JsonNode> f : results) {
                ids.add(f.get().get("submissionId").asLong());
            }
            assertThat(ids).hasSize(threads).containsOnly(ids.get(0));
        } finally {
            pool.shutdownNow();
        }
        assertThat(count("answer_submission")).isEqualTo(1);
        assertThat(count("concept_progress")).isEqualTo(1);
    }

    @Test
    void 배운_날_판정_문제를_모두_맞히면_3일_뒤_첫_확인이_잡힌다() throws Exception {
        submit(version("lazy-loop-count"), "4", null).andExpect(status().isOk());
        submit(version("lazy-loop-count"), "4", null).andExpect(status().isOk()); // 같은 문제를 또 맞혀도 한 문제다
        submit(version("lazy-loop-ox"), "O", null).andExpect(status().isOk()); // 틀린 답은 세지 않는다
        assertThat(progress("lazy-loop")).isEqualTo(new Progress(0, null, null));

        // 틀린 문제를 다시 풀어 맞히면 판정 문제를 모두 맞힌 것이다
        submit(version("lazy-loop-ox"), "X", null).andExpect(status().isOk());
        assertThat(progress("lazy-loop")).isEqualTo(new Progress(1, DAY0, DAY0.plusDays(3)));

        // 다음 날 같은 개념을 레슨에서 또 풀어도 일정은 그대로다
        clock.advance(Duration.ofDays(1));
        submit(version("lazy-loop-ox"), "X", null).andExpect(status().isOk());
        assertThat(progress("lazy-loop")).isEqualTo(new Progress(1, DAY0, DAY0.plusDays(3)));
    }

    @Test
    void 배운_날_기준은_같은_날_정답만_센다() throws Exception {
        submit(version("lazy-loop-count"), "4", null).andExpect(status().isOk());
        clock.advance(Duration.ofDays(1));
        submit(version("lazy-loop-ox"), "X", null).andExpect(status().isOk());

        assertThat(progress("lazy-loop").stage()).isZero();
    }

    @Test
    void 사흘째에_가장_오래전에_푼_문제로_다시_묻는다() throws Exception {
        learn("lazy-loop");

        clock.advance(Duration.ofDays(2));
        assertThat(getJson("/api/me/delayed-checks/today")).isEmpty();

        clock.advance(Duration.ofDays(1));
        JsonNode today = getJson("/api/me/delayed-checks/today");
        assertThat(today).hasSize(1);
        assertThat(today.get(0).get("conceptName").asText()).isEqualTo("지연 로딩 컬렉션을 루프에서 읽을 때 생기는 추가 쿼리");
        assertThat(today.get(0).get("attemptNo").asInt()).isEqualTo(1);
        // 레슨에서 판정 문제를 모두 풀었으니 가장 오래전에 푼 객관식을 낸다 (learn은 객관식 → OX 순서로 푼다)
        assertThat(today.get(0).get("question").get("questionVersionId").asLong()).isEqualTo(version("lazy-loop-count"));
        assertThat(today.get(0).get("question").has("answer")).isFalse();
    }

    @Test
    void 지연_확인을_맞히면_다음_단계로_가고_오늘_목록에서_빠진다() throws Exception {
        learn("lazy-loop");
        clock.advance(Duration.ofDays(3));

        submit(version("lazy-loop-ox"), "X", "DELAYED_CHECK").andExpect(status().isOk())
                .andExpect(jsonPath("$.correct").value(true))
                .andExpect(jsonPath("$.delayedCheck").value(true));

        assertThat(progress("lazy-loop")).isEqualTo(new Progress(2, DAY0, DAY0.plusDays(7)));
        assertThat(jdbc.queryForList("""
                select attempt_no || ' ' || result || ' ' || stage_after from delayed_check where user_id = ?
                """, String.class, userId)).containsExactly("1 CORRECT 2");
        assertThat(getJson("/api/me/delayed-checks/today")).isEmpty();
    }

    @Test
    void 재확인_세_번을_모두_통과하면_졸업하고_더는_묻지_않는다() throws Exception {
        learn("lazy-loop");

        clock.advance(Duration.ofDays(3));
        checkToday("lazy-loop", true);
        clock.advance(Duration.ofDays(4));
        assertThat(getJson("/api/me/delayed-checks/today").get(0).get("attemptNo").asInt()).isEqualTo(2);
        checkToday("lazy-loop", true);
        clock.advance(Duration.ofDays(14));
        assertThat(getJson("/api/me/delayed-checks/today").get(0).get("attemptNo").asInt()).isEqualTo(3);
        checkToday("lazy-loop", true);

        assertThat(progress("lazy-loop")).isEqualTo(new Progress(4, DAY0, null));
        clock.advance(Duration.ofDays(100));
        assertThat(getJson("/api/me/delayed-checks/today")).isEmpty();

        JsonNode concepts = getJson("/api/me/concepts");
        assertThat(concepts).hasSize(1);
        assertThat(concepts.get(0).get("graduated").asBoolean()).isTrue();
        assertThat(concepts.get(0).get("stage").asInt()).isEqualTo(4);
        assertThat(concepts.get(0).get("graduatedAt").isNull()).isFalse();
    }

    @Test
    void 기록은_실제_풀이와_확인에서_센_값만_준다() throws Exception {
        // 배운 날 첫 시도: 맞힘 2 + 틀림 1. 다시 풀어 또 틀린 답은 첫 시도가 아니라 정답률에 넣지 않는다
        learn("lazy-loop");
        submit(version("fetch-join-predict"), "2", null).andExpect(status().isOk());
        submit(version("fetch-join-predict"), "2", null).andExpect(status().isOk());
        // 3일 확인 맞힘, 7일 확인 틀림
        clock.advance(Duration.ofDays(3));
        checkToday("lazy-loop", true);
        clock.advance(Duration.ofDays(4));
        checkToday("lazy-loop", false);

        JsonNode report = getJson("/api/me/report");

        assertThat(report.get("today").asText()).isEqualTo(DAY0.plusDays(7).toString());
        assertThat(report.get("retrievals").asInt()).isEqualTo(6);
        JsonNode curve = report.get("curve");
        assertThat(curve.get("learnedDay").get("correct").asInt()).isEqualTo(2);
        assertThat(curve.get("learnedDay").get("total").asInt()).isEqualTo(3);
        assertThat(curve.get("day3").get("correct").asInt()).isEqualTo(1);
        assertThat(curve.get("day7").get("correct").asInt()).isZero();
        assertThat(curve.get("day7").get("total").asInt()).isEqualTo(1);
        assertThat(curve.get("day21").get("total").asInt()).isZero();
        // lazy-loop는 7일 확인에서 틀려 1단계로, fetch-join은 배우는 중
        assertThat(report.get("stages").get("passed1").asInt()).isEqualTo(1);
        assertThat(report.get("stages").get("learning").asInt()).isEqualTo(1);
        // 답을 낸 날은 배운 날, 3일 뒤, 7일 뒤
        assertThat(report.get("activity")).hasSize(3);
        assertThat(report.get("activity").get(0).get("count").asInt()).isEqualTo(4);
    }

    @Test
    void 마지막_확인에만_가르치듯_말해_볼_서술형_질문을_함께_준다() throws Exception {
        learn("fetch-join");
        clock.advance(Duration.ofDays(3));
        assertThat(getJson("/api/me/delayed-checks/today").get(0).get("teach").isNull()).isTrue();
        checkToday("fetch-join", true);
        clock.advance(Duration.ofDays(4));
        checkToday("fetch-join", true);
        clock.advance(Duration.ofDays(14));

        JsonNode last = getJson("/api/me/delayed-checks/today").get(0);
        assertThat(last.get("attemptNo").asInt()).isEqualTo(3);
        JsonNode teach = last.get("teach");
        assertThat(teach.get("body").asText()).isEqualTo("N+1 문제가 무엇이고 어떻게 해결하는지 면접에서 답하듯 설명해 보세요.");
        assertThat(teach.get("checklist")).hasSize(4);
        assertThat(teach.get("questionVersionId").asLong()).isEqualTo(version("fetch-join-explain"));
    }

    @Test
    void 서술형_문제가_없는_개념은_마지막_확인에도_teach가_없다() throws Exception {
        learn("lazy-loop");
        clock.advance(Duration.ofDays(3));
        checkToday("lazy-loop", true);
        clock.advance(Duration.ofDays(4));
        checkToday("lazy-loop", true);
        clock.advance(Duration.ofDays(14));

        JsonNode last = getJson("/api/me/delayed-checks/today").get(0);
        assertThat(last.get("attemptNo").asInt()).isEqualTo(3);
        assertThat(last.get("teach").isNull()).isTrue();
    }

    @Test
    void 내_프로필은_닉네임과_가입한_날부터_며칠째인지_준다() throws Exception {
        jdbc.update("update users set created_at = ? where id = ?",
                java.sql.Timestamp.from(START.minus(Duration.ofDays(2))), userId);

        JsonNode me = getJson("/api/me");

        assertThat(me.get("nickname").asText()).isEqualTo("tester");
        assertThat(me.get("joinedOn").asText()).isEqualTo(DAY0.minusDays(2).toString());
        assertThat(me.get("days").asLong()).isEqualTo(3);
    }

    @Test
    void 재확인에서_틀리면_한_단계_돌아간다() throws Exception {
        learn("lazy-loop");
        clock.advance(Duration.ofDays(3));
        checkToday("lazy-loop", true);
        clock.advance(Duration.ofDays(4));

        checkToday("lazy-loop", false);

        assertThat(progress("lazy-loop")).isEqualTo(new Progress(1, DAY0, DAY0.plusDays(10)));
    }

    @Test
    void 예정되지_않은_지연_확인은_받지_않는다() throws Exception {
        submit(version("lazy-loop-count"), "4", null).andExpect(status().isOk());

        submit(version("lazy-loop-ox"), "X", "DELAYED_CHECK").andExpect(status().isConflict());
        assertThat(count("answer_submission")).isEqualTo(1);

        // 배운 날 기준을 통과해도 사흘이 지나기 전에는 받지 않는다
        learn("lazy-loop");
        clock.advance(Duration.ofDays(2));
        submit(version("lazy-loop-ox"), "X", "DELAYED_CHECK").andExpect(status().isConflict());
    }

    @Test
    void 새벽_4시_전에_푼_문제는_전날_공부로_센다() throws Exception {
        clock.set(Instant.parse("2026-11-16T18:30:00Z")); // 2026-11-17 03:30 KST

        learn("lazy-loop");

        assertThat(jdbc.queryForList("select distinct service_date from answer_submission", LocalDate.class))
                .containsExactly(LocalDate.of(2026, 11, 16));
        assertThat(progress("lazy-loop"))
                .isEqualTo(new Progress(1, LocalDate.of(2026, 11, 16), LocalDate.of(2026, 11, 19)));
    }

    @Test
    void 지연_확인에서_틀리면_다른_문제로_연습하고_연습은_일정을_바꾸지_않는다() throws Exception {
        learn("lazy-loop");
        clock.advance(Duration.ofDays(3));
        checkToday("lazy-loop", false);
        Progress afterCheck = progress("lazy-loop");

        long conceptId = conceptId("lazy-loop");
        JsonNode practice = getJson("/api/me/concepts/" + conceptId + "/practice-question");
        // 방금 틀린 객관식이 아니라 다른 문제(OX)를 낸다. 정답은 주지 않는다
        assertThat(practice.get("questionVersionId").asLong()).isEqualTo(version("lazy-loop-ox"));
        assertThat(practice.has("answer")).isFalse();

        submit(version("lazy-loop-ox"), "X", "PRACTICE").andExpect(status().isOk())
                .andExpect(jsonPath("$.correct").value(true))
                .andExpect(jsonPath("$.delayedCheck").value(false));
        assertThat(progress("lazy-loop")).isEqualTo(afterCheck);
        assertThat(count("delayed_check")).isEqualTo(1);
        assertThat(jdbc.queryForObject("select first_attempt from answer_submission order by id desc limit 1",
                Boolean.class)).isFalse();
    }

    @Test
    void 배우는_중인_개념은_연습할_수_없다() throws Exception {
        submit(version("lazy-loop-count"), "4", null).andExpect(status().isOk());

        mvc.perform(get("/api/me/concepts/" + conceptId("lazy-loop") + "/practice-question")
                        .header("X-Dev-User-Id", userId))
                .andExpect(status().isNotFound());
        submit(version("lazy-loop-ox"), "X", "PRACTICE").andExpect(status().isConflict());
        assertThat(count("answer_submission")).isEqualTo(1);
    }

    @Test
    void 끝낸_레슨을_다시_풀면_첫_시도가_아니고_일정도_그대로다() throws Exception {
        learn("lazy-loop");
        clock.advance(Duration.ofDays(1));
        submit(version("lazy-loop-count"), "1", null).andExpect(status().isOk());

        assertThat(progress("lazy-loop")).isEqualTo(new Progress(1, DAY0, DAY0.plusDays(3)));
        assertThat(jdbc.queryForList("select first_attempt from answer_submission order by id", Boolean.class))
                .containsExactly(true, true, false);
    }

    @Test
    void 기억_기록은_맞힐_때_늘고_틀려도_줄지_않는다() throws Exception {
        // 배운 날: 마지막 문제를 맞혀 학습을 마친 답에만 기록이 는다 (0 → 1)
        List<Long> versions = jdbc.queryForList("""
                select v.id from question q join question_version v on v.id = q.current_version_id
                join concept c on c.id = q.concept_id
                where c.external_key = 'dev/n-plus-1/lazy-loop' and q.purpose = 'JUDGMENT' and q.status = 'REVIEWED'
                order by q.sort_order, q.id
                """, Long.class);
        for (int i = 0; i < versions.size(); i++) {
            String answer = jdbc.queryForObject("select answer from question_version where id = ?", String.class,
                    versions.get(i));
            JsonNode result = body(submit(versions.get(i), answer, null));
            assertThat(result.get("retrievals").asInt()).isEqualTo(i + 1);
            if (i < versions.size() - 1) {
                assertThat(result.get("record").isNull()).isTrue();
            } else {
                assertThat(result.get("record").get("before").asInt()).isZero();
                assertThat(result.get("record").get("after").asInt()).isEqualTo(1);
            }
        }

        // 3일 뒤 확인을 맞히면 1 → 2
        clock.advance(Duration.ofDays(3));
        JsonNode today = getJson("/api/me/delayed-checks/today").get(0).get("question");
        String answer = jdbc.queryForObject("select answer from question_version where id = ?", String.class,
                today.get("questionVersionId").asLong());
        UUID clientId = UUID.randomUUID();
        JsonNode passed = body(submit(clientId, today.get("questionVersionId").asLong(), answer,
                "DELAYED_CHECK"));
        assertThat(passed.get("record").get("before").asInt()).isEqualTo(1);
        assertThat(passed.get("record").get("after").asInt()).isEqualTo(2);
        // 같은 제출을 다시 보내면 기록이 또 는 것처럼 보이지 않는다
        JsonNode again = body(submit(clientId, today.get("questionVersionId").asLong(), answer,
                "DELAYED_CHECK"));
        assertThat(again.get("record").isNull()).isTrue();

        // 7일 뒤 확인에서 틀리면 단계는 내려가지만 기록은 그대로다
        clock.advance(Duration.ofDays(4));
        checkToday("lazy-loop", false);
        JsonNode concept = getJson("/api/me/concepts").get(0);
        assertThat(concept.get("stage").asInt()).isEqualTo(1);
        assertThat(concept.get("bestStage").asInt()).isEqualTo(2);

        // 다시 3일 뒤 확인을 맞혀 2단계로 돌아와도, 이미 도달했던 단계라 기록이 늘지 않는다
        clock.advance(Duration.ofDays(3));
        JsonNode retry = getJson("/api/me/delayed-checks/today").get(0).get("question");
        String retryAnswer = jdbc.queryForObject("select answer from question_version where id = ?", String.class,
                retry.get("questionVersionId").asLong());
        JsonNode back = body(submit(retry.get("questionVersionId").asLong(), retryAnswer, "DELAYED_CHECK"));
        assertThat(back.get("record").isNull()).isTrue();
    }

    @Test
    void 오늘_화면은_쌓이기만_하는_값을_준다() throws Exception {
        JsonNode empty = getJson("/api/me/home");
        assertThat(empty.get("today").asText()).isEqualTo(DAY0.toString());
        assertThat(empty.get("streak").asInt()).isZero();
        assertThat(empty.get("checksTotal").asInt()).isZero();
        assertThat(empty.get("learned").asInt()).isZero();

        // 배운 날 (화요일): 연속 1일, 배운 개념 1
        learn("lazy-loop");
        JsonNode learned = getJson("/api/me/home");
        assertThat(learned.get("streak").asInt()).isEqualTo(1);
        assertThat(learned.get("activeDates")).hasSize(1);
        assertThat(learned.get("activeDates").get(0).asText()).isEqualTo(DAY0.toString());
        assertThat(learned.get("learned").asInt()).isEqualTo(1);
        assertThat(learned.get("longTerm").asInt()).isZero();
        // 이 개념의 판정 문제는 2개다
        assertThat(learned.get("retrievals").asInt()).isEqualTo(2);
        assertThat(learned.get("checksDone").asInt()).isZero();
        assertThat(learned.get("checksTotal").asInt()).isZero();

        // 다음 날 아직 답을 내지 않았으면 연속은 어제까지 센 값이다
        clock.advance(Duration.ofDays(1));
        assertThat(getJson("/api/me/home").get("streak").asInt()).isEqualTo(1);

        // 3일 뒤 (금요일): 하루 넘게 걸러 연속은 끊겼고, 오늘 확인이 하나 남았다
        clock.advance(Duration.ofDays(2));
        JsonNode due = getJson("/api/me/home");
        assertThat(due.get("streak").asInt()).isZero();
        assertThat(due.get("checksDone").asInt()).isZero();
        assertThat(due.get("checksTotal").asInt()).isEqualTo(1);

        // 확인을 틀려도 오늘 끝낸 확인으로 세고, 배운 개념 수는 줄지 않는다
        checkToday("lazy-loop", false);
        JsonNode done = getJson("/api/me/home");
        assertThat(done.get("checksDone").asInt()).isEqualTo(1);
        assertThat(done.get("checksTotal").asInt()).isEqualTo(1);
        assertThat(done.get("streak").asInt()).isEqualTo(1);
        assertThat(done.get("activeDates")).hasSize(2);
        assertThat(done.get("learned").asInt()).isEqualTo(1);
        assertThat(done.get("retrievals").asInt()).isEqualTo(3);
    }

    @Test
    void 로그인하지_않으면_401() throws Exception {
        mvc.perform(get("/api/me/delayed-checks/today")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me/delayed-checks/today").header("X-Dev-User-Id", 9999))
                .andExpect(status().isUnauthorized());
    }

    private ResultActions submit(long versionId, String selected, String mode) throws Exception {
        return submit(UUID.randomUUID(), versionId, selected, mode);
    }

    private ResultActions submit(UUID clientId, long versionId, String selected, String mode)
            throws Exception {
        String body = """
                {"clientSubmissionId": "%s", "questionVersionId": %d, "selected": "%s", "mode": %s}
                """.formatted(clientId, versionId, selected, mode == null ? "null" : "\"" + mode + "\"");
        return mvc.perform(post("/api/submissions").header("X-Dev-User-Id", userId).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private JsonNode body(ResultActions result) throws Exception {
        String content = result.andExpect(status().isOk()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        return json.readTree(content);
    }

    /** 핵심 질문 둘, 질문마다 판정 문제 둘. 배운 날에는 질문마다 첫 문제만 묻는다 */
    private static final String CORE_QUESTIONS = """
            subject: {key: dev, name: 개발자 면접}
            lesson: {key: cq, title: 핵심 질문 레슨, unit: JPA, order: 7}
            concepts:
              - {key: core, name: 핵심 질문 레슨}
            coreQuestions:
              - {key: q1, text: 첫째 질문}
              - {key: q2, text: 둘째 질문}
            questions:
              - {key: q1-book, concept: core, coreQuestion: q1, type: ox, status: reviewed, difficulty: 1, body: 본문의 예시로 묻는 문제, answer: O, explanation: 설명}
              - {key: q1-moved, concept: core, coreQuestion: q1, type: ox, status: reviewed, difficulty: 1, body: 다른 상황으로 옮긴 문제, answer: X, explanation: 설명}
              - {key: q2-draft, concept: core, coreQuestion: q2, type: ox, status: draft, difficulty: 1, body: 아직 검수하지 않은 문제, answer: O, explanation: 설명}
              - {key: q2-book, concept: core, coreQuestion: q2, type: ox, status: reviewed, difficulty: 1, body: 본문의 예시로 묻는 문제 2, answer: O, explanation: 설명}
              - {key: q2-moved, concept: core, coreQuestion: q2, type: ox, status: reviewed, difficulty: 1, body: 다른 상황으로 옮긴 문제 2, answer: X, explanation: 설명}
              - {key: interview, concept: core, coreQuestion: all, type: descriptive, status: reviewed, difficulty: 2, body: 설명해 보세요, explanation: 설명, checklist: [하나, 둘, 셋, 넷]}
            """;

    @Test
    void 핵심_질문이_있는_레슨은_질문마다_첫_문제만_배운_날에_묻는다() throws Exception {
        importer.importYaml("cq.yaml", CORE_QUESTIONS);
        long cq = jdbc.queryForObject("select id from lesson where external_key = 'dev/cq'", Long.class);

        // 검수 완료된 판정 문제 가운데 질문마다 파일에서 가장 먼저 나오는 것. 검수 전 문제는 건너뛴다
        assertThat(jdbc.queryForList("select external_key from question where lesson_id = ? and lesson_day order by sort_order",
                String.class, cq)).containsExactly("dev/cq/q1-book", "dev/cq/q2-book");

        JsonNode questions = getJson("/api/lessons/" + cq + "/questions");
        assertThat(questions).hasSize(2);
        assertThat(questions.get(0).get("body").asText()).isEqualTo("본문의 예시로 묻는 문제");
        JsonNode lessons = getJson("/api/lessons");
        assertThat(lessons.get(1).get("key").asText()).isEqualTo("cq");
        assertThat(lessons.get(1).get("questionCount").asInt()).isEqualTo(2);

        // 두 문제만 맞히면 배운 것으로 친다. 판정 문제는 넷이지만 나머지 둘은 풀지 않았다
        submit(questions.get(0).get("questionVersionId").asLong(), "O", null).andExpect(status().isOk());
        submit(questions.get(1).get("questionVersionId").asLong(), "O", null).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("""
                select p.stage from concept_progress p join concept c on c.id = p.concept_id
                where p.user_id = ? and c.external_key = 'dev/cq/core'
                """, Integer.class, userId)).isEqualTo(1);

        // 3일 뒤의 확인에는 배운 날에 풀지 않은 문제가 나온다
        clock.advance(Duration.ofDays(3));
        JsonNode check = null;
        for (JsonNode c : getJson("/api/me/delayed-checks/today")) {
            if (c.get("conceptName").asText().equals("핵심 질문 레슨")) {
                check = c;
            }
        }
        assertThat(check).isNotNull();
        assertThat(check.get("question").get("body").asText()).isEqualTo("다른 상황으로 옮긴 문제");
    }

    @Test
    void 핵심_질문이_없는_레슨은_판정_문제를_모두_배운_날에_묻는다() throws Exception {
        assertThat(jdbc.queryForObject(
                "select count(*) from question where lesson_id = ? and purpose = 'JUDGMENT' and lesson_day",
                Integer.class, lessonId)).isEqualTo(3);
        assertThat(getJson("/api/lessons/" + lessonId + "/questions")).hasSize(3);
    }

    private JsonNode getJson(String url) throws Exception {
        return body(mvc.perform(get(url).header("X-Dev-User-Id", userId)));
    }

    private long version(String questionKey) {
        return jdbc.queryForObject("select current_version_id from question where external_key = ?",
                Long.class, "dev/n-plus-1/" + questionKey);
    }

    /** 레슨에서 개념의 판정 문제를 순서대로 모두 맞혀 배운 날 기준을 통과한다 */
    private void learn(String conceptKey) throws Exception {
        List<Map<String, Object>> questions = jdbc.queryForList("""
                select v.id, v.answer from question q
                join question_version v on v.id = q.current_version_id
                join concept c on c.id = q.concept_id
                where c.external_key = ? and q.purpose = 'JUDGMENT' and q.status = 'REVIEWED'
                order by q.sort_order, q.id
                """, "dev/n-plus-1/" + conceptKey);
        for (Map<String, Object> q : questions) {
            submit(((Number) q.get("id")).longValue(), (String) q.get("answer"), null)
                    .andExpect(status().isOk());
        }
        assertThat(progress(conceptKey).stage()).isEqualTo(1);
    }

    /** 오늘 목록에서 이 개념의 문제를 찾아 맞히거나 틀린다 */
    private void checkToday(String conceptKey, boolean correct) throws Exception {
        long conceptId = jdbc.queryForObject("select id from concept where external_key = ?", Long.class,
                "dev/n-plus-1/" + conceptKey);
        JsonNode question = null;
        for (JsonNode check : getJson("/api/me/delayed-checks/today")) {
            if (check.get("conceptId").asLong() == conceptId) {
                question = check.get("question");
            }
        }
        assertThat(question).as("오늘 확인할 개념에 " + conceptKey + "가 있다").isNotNull();
        long versionId = question.get("questionVersionId").asLong();
        String answer = jdbc.queryForObject("select answer from question_version where id = ?", String.class, versionId);
        String selected = correct ? answer : wrongAnswer(question.get("type").asText(), answer);
        submit(versionId, selected, "DELAYED_CHECK").andExpect(status().isOk())
                .andExpect(jsonPath("$.correct").value(correct));
    }

    private static String wrongAnswer(String type, String answer) {
        if (type.equals("OX")) {
            return answer.equals("O") ? "X" : "O";
        }
        return answer.equals("1") ? "2" : "1";
    }

    record Progress(int stage, LocalDate learnedOn, LocalDate dueDate) {
    }

    private Progress progress(String conceptKey) {
        return jdbc.queryForObject("""
                select p.stage, p.learned_on, p.due_date from concept_progress p join concept c on c.id = p.concept_id
                where p.user_id = ? and c.external_key = ?
                """, (rs, n) -> new Progress(rs.getInt("stage"), rs.getObject("learned_on", LocalDate.class),
                rs.getObject("due_date", LocalDate.class)), userId, "dev/n-plus-1/" + conceptKey);
    }

    private long conceptId(String conceptKey) {
        return jdbc.queryForObject("select id from concept where external_key = ?", Long.class,
                "dev/n-plus-1/" + conceptKey);
    }

    private int count(String table) {
        return jdbc.queryForObject("select count(*) from " + table, Integer.class);
    }
}
