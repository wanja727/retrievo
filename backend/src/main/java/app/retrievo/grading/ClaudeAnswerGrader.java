package app.retrievo.grading;

import com.anthropic.client.AnthropicClient;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.StructuredMessage;
import com.anthropic.models.messages.StructuredMessageCreateParams;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import java.util.ArrayList;
import java.util.List;

/** Claude로 채점한다. 답의 형식은 구조화 출력으로 고정한다 */
public final class ClaudeAnswerGrader implements AnswerGrader {

    private static final long MAX_TOKENS = 2000;

    private final AnthropicClient client;
    private final String model;

    public ClaudeAnswerGrader(AnthropicClient client, String model) {
        this.client = client;
        this.model = model;
    }

    /** 모델이 내는 답의 모양 */
    public record Grading(List<Judgement> points) {
    }

    public record Judgement(
            @JsonPropertyDescription("포인트의 번호. 1부터") int number,
            @JsonPropertyDescription("이 포인트의 내용이 답에 들어 있는가") boolean included,
            @JsonPropertyDescription("학습자에게 보여 줄 한 문장. 해요체") String comment) {
    }

    @Override
    public Grade grade(String question, List<String> points, String answer) {
        StructuredMessageCreateParams<Grading> params = MessageCreateParams.builder()
                .model(model)
                .maxTokens(MAX_TOKENS)
                .system(GradingPrompt.SYSTEM)
                .outputConfig(Grading.class)
                .addUserMessage(GradingPrompt.user(question, points, answer))
                .build();

        long started = System.nanoTime();
        StructuredMessage<Grading> response;
        try {
            response = client.messages().create(params);
        } catch (RuntimeException e) {
            throw new GradingFailedException("채점 모델을 부르지 못했다: " + e.getMessage(), e);
        }
        long millis = (System.nanoTime() - started) / 1_000_000;

        Grading grading;
        try {
            grading = response.content().stream()
                    .flatMap(block -> block.text().stream())
                    .map(text -> text.text())
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException("답에 글이 없다 (stop_reason: "
                            + response.stopReason().map(Object::toString).orElse("?") + ")"));
        } catch (RuntimeException e) {
            throw new GradingFailedException("채점 결과를 읽지 못했다: " + e.getMessage(), e);
        }
        return new Grade(inOrder(grading, points.size()),
                new Usage(response.usage().inputTokens(), response.usage().outputTokens(), millis));
    }

    /** 번호 순서로 맞춘다. 빠지거나 겹친 번호가 있으면 채점 실패로 본다 */
    static List<PointResult> inOrder(Grading grading, int count) {
        PointResult[] results = new PointResult[count];
        if (grading == null || grading.points() == null) {
            throw new GradingFailedException("채점 결과가 비었다", null);
        }
        for (Judgement j : grading.points()) {
            int index = j.number() - 1;
            if (index < 0 || index >= count || results[index] != null) {
                throw new GradingFailedException("포인트 번호가 맞지 않는다: " + j.number(), null);
            }
            results[index] = new PointResult(j.included(), j.comment() == null ? "" : j.comment().strip());
        }
        List<PointResult> list = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            if (results[i] == null) {
                throw new GradingFailedException("포인트 " + (i + 1) + "의 판정이 없다", null);
            }
            list.add(results[i]);
        }
        return list;
    }
}
