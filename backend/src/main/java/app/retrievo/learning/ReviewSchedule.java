package app.retrievo.learning;

import java.time.LocalDate;

/**
 * 복습 기준 (ADR-017). 상태 저장 없이 다음 단계와 날짜만 계산한다.
 *
 * <ul>
 *   <li>단계 = 통과한 확인 수. 0 = 배우는 중, 1~3 = 재확인 중, 4 = 졸업
 *   <li>배운 날: 같은 날 레슨 판정 문제를 모두 한 번씩 맞히면 1단계. 틀린 문제는 맞힐 때까지 다시 낸다(ADR-021).
 *       3일 뒤 첫 재확인을 잡는다
 *   <li>재확인에서 틀리면 그날 같은 개념의 다른 문제를 맞힐 때까지 연습으로 다시 배운다(일정은 바꾸지 않는다)
 *   <li>재확인을 맞히면 다음 단계. 간격은 3일 → 4일 → 14일이라, 제때 확인하면 배운 날부터 3일·7일·21일 뒤가 된다
 *   <li>틀리면 한 단계 돌아가고 그 단계의 간격으로 다시 묻는다(1단계 아래로는 내려가지 않는다)
 *   <li>4단계(재확인 세 번 통과)면 졸업. 더는 묻지 않는다
 * </ul>
 *
 * 근거: 첫 세션에서 맞힐 때까지 + 넓은 간격의 재학습(successive relearning, Rawson &amp; Dunlosky 2011·2022),
 * 간격을 늘리든 일정하게 두든 차이 없고 총 간격이 중요(Latimier 외 2021).
 * 3·7·21일이라는 날짜 자체는 직접 정한 값이다.
 */
final class ReviewSchedule {

    static final int LEARNING = 0;
    static final int GRADUATED = 4;
    /**
     * 배운 날 기준: 레슨 판정 문제(3~4개)를 그날 모두 한 번씩 맞혔는가 (ADR-021).
     * 틀린 문제는 화면이 다시 내므로 맞힐 때까지 풀게 된다. 판정 문제가 없는 개념은 배울 수 없다
     */
    static boolean learnedToday(int judgmentQuestions, int correctToday) {
        return judgmentQuestions > 0 && correctToday >= judgmentQuestions;
    }

    private ReviewSchedule() {
    }

    /** 확인 뒤 상태. 졸업했으면 dueDate는 null */
    record Next(int stage, LocalDate dueDate) {

        boolean graduated() {
            return stage == GRADUATED;
        }
    }

    /** 단계 stage에 막 올라섰을 때 다음 확인까지의 날 수 */
    static int gapDays(int stage) {
        return switch (stage) {
            case 1 -> 3;
            case 2 -> 4;
            case 3 -> 14;
            default -> throw new IllegalArgumentException("재확인 단계는 1~3이다: " + stage);
        };
    }

    /** 배운 날 기준을 통과했을 때 */
    static Next learned(LocalDate today) {
        return new Next(1, today.plusDays(gapDays(1)));
    }

    /** 재확인 결과에 따른 다음 상태. stage는 확인 전 단계(1~3) */
    static Next afterCheck(int stage, boolean correct, LocalDate today) {
        if (stage < 1 || stage > 3) {
            throw new IllegalArgumentException("재확인 단계는 1~3이다: " + stage);
        }
        if (correct) {
            int next = stage + 1;
            return next == GRADUATED
                    ? new Next(GRADUATED, null)
                    : new Next(next, today.plusDays(gapDays(next)));
        }
        int back = Math.max(1, stage - 1);
        return new Next(back, today.plusDays(gapDays(back)));
    }
}
