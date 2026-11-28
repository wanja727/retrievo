package app.retrievo.grading;

import java.util.List;

/**
 * 핵심 질문에 사용자가 쓴 답을 핵심 포인트로 채점한다 (노션 ADR-027).
 * 포인트마다 답에 들어 있는지를 판정하고, 사용자에게 보여 줄 한 문장을 단다.
 */
public interface AnswerGrader {

    /** 답의 최대 길이. 넘는 부분은 잘라서 채점한다 */
    int MAX_ANSWER_LENGTH = 1000;

    Grade grade(String question, List<String> points, String answer);

    /** results는 points와 같은 순서, 같은 개수다 */
    record Grade(List<PointResult> results, Usage usage) {

        public boolean passed() {
            return results.stream().allMatch(PointResult::included);
        }
    }

    record PointResult(boolean included, String comment) {
    }

    /** 비용과 응답 시간을 재는 데 쓴다 */
    record Usage(long inputTokens, long outputTokens, long millis) {
    }

    /** 모델이 형식에 맞지 않는 답을 냈거나 호출이 실패했다. 부르는 쪽은 스스로 체크하기로 넘긴다 */
    class GradingFailedException extends RuntimeException {

        public GradingFailedException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
