package app.retrievo.learning;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class StreaksTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 22);

    @Test
    void 오늘까지_이어진_날을_센다() {
        assertThat(Streaks.count(List.of(TODAY.minusDays(2), TODAY.minusDays(1), TODAY), TODAY)).isEqualTo(3);
    }

    @Test
    void 오늘_아직_답을_내지_않았으면_어제까지_센다() {
        assertThat(Streaks.count(List.of(TODAY.minusDays(2), TODAY.minusDays(1)), TODAY)).isEqualTo(2);
    }

    @Test
    void 하루를_거르면_그_앞은_세지_않는다() {
        assertThat(Streaks.count(List.of(TODAY.minusDays(5), TODAY.minusDays(4), TODAY.minusDays(1), TODAY), TODAY))
                .isEqualTo(2);
    }

    @Test
    void 어제도_오늘도_답이_없으면_0이다() {
        assertThat(Streaks.count(List.of(TODAY.minusDays(2)), TODAY)).isZero();
        assertThat(Streaks.count(List.of(), TODAY)).isZero();
    }

    @Test
    void 주는_월요일에_시작한다() {
        // 2026-11-22는 일요일, 2026-11-23은 월요일
        assertThat(Streaks.weekStart(TODAY)).isEqualTo(LocalDate.of(2026, 11, 16));
        assertThat(Streaks.weekStart(TODAY.plusDays(1))).isEqualTo(LocalDate.of(2026, 11, 23));
    }
}
