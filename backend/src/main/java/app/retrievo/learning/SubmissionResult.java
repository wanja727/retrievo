package app.retrievo.learning;

/**
 * 답을 낸 뒤에야 받는 결과. 정답과 해설은 여기서 처음 보인다.
 * record: 이 답으로 기억 기록(가장 높이 도달한 단계)이 늘었으면 전과 후, 늘지 않았으면 null (ADR-025).
 * 같은 제출을 다시 보내 처음 결과를 돌려받을 때는 null이다 (기록이 는 것은 처음 한 번뿐이다).
 * retrievals: 지금까지 낸 답 수. 이 답을 포함한다
 */
public record SubmissionResult(
        long submissionId,
        boolean correct,
        String selected,
        String answer,
        String explanation,
        String sourceUrl,
        boolean delayedCheck,
        RecordUp record,
        int retrievals) {

    /** 기억 기록이 before 단계에서 after 단계로 늘었다 */
    public record RecordUp(int before, int after) {
    }
}
