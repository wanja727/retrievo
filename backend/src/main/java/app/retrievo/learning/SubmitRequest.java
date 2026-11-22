package app.retrievo.learning;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * 답안 제출.
 * clientSubmissionId: 화면이 문제마다 만드는 UUID. 같은 값으로 다시 오면 처음 결과를 돌려준다 (재시도·두 번 누르기)
 * selected: 객관식·코드 예측은 보기 번호(1부터), OX는 O 또는 X
 */
public record SubmitRequest(
        @NotNull UUID clientSubmissionId,
        @NotNull Long questionVersionId,
        @NotBlank String selected,
        SubmissionMode mode) {

    public SubmissionMode modeOrDefault() {
        return mode == null ? SubmissionMode.LESSON : mode;
    }
}
