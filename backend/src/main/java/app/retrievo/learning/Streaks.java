package app.retrievo.learning;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

/** 연속 학습 일수 계산. 상태 저장 없이 답을 낸 날의 목록에서 센다 */
final class Streaks {

    private Streaks() {
    }

    /**
     * 답을 낸 날이 오늘까지 며칠 이어졌는지. 오늘 아직 답을 내지 않았으면 어제까지 이어진 일수를 준다
     * (오늘이 끝나기 전에는 끊긴 것이 아니다). 어제도 답이 없으면 0
     */
    static int count(Collection<LocalDate> activeDates, LocalDate today) {
        Set<LocalDate> active = new HashSet<>(activeDates);
        LocalDate day = active.contains(today) ? today : today.minusDays(1);
        int streak = 0;
        while (active.contains(day)) {
            streak++;
            day = day.minusDays(1);
        }
        return streak;
    }

    /** today가 있는 주의 월요일 */
    static LocalDate weekStart(LocalDate today) {
        return today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }
}
