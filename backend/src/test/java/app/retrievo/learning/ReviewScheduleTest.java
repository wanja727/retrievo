package app.retrievo.learning;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class ReviewScheduleTest {

    private static final LocalDate LEARNED = LocalDate.of(2026, 11, 17);

    @Test
    void 제때_확인하면_배운_날부터_3일_7일_21일_뒤에_묻고_졸업한다() {
        ReviewSchedule.Next first = ReviewSchedule.learned(LEARNED);
        assertThat(first).isEqualTo(new ReviewSchedule.Next(1, LEARNED.plusDays(3)));

        ReviewSchedule.Next second = ReviewSchedule.afterCheck(1, true, first.dueDate());
        assertThat(second).isEqualTo(new ReviewSchedule.Next(2, LEARNED.plusDays(7)));

        ReviewSchedule.Next third = ReviewSchedule.afterCheck(2, true, second.dueDate());
        assertThat(third).isEqualTo(new ReviewSchedule.Next(3, LEARNED.plusDays(21)));

        ReviewSchedule.Next done = ReviewSchedule.afterCheck(3, true, third.dueDate());
        assertThat(done.graduated()).isTrue();
        assertThat(done.dueDate()).isNull();
    }

    @Test
    void 배운_날_기준은_판정_문제를_모두_맞히는_것이다() {
        assertThat(ReviewSchedule.learnedToday(3, 3)).isTrue();
        assertThat(ReviewSchedule.learnedToday(4, 3)).isFalse();
        assertThat(ReviewSchedule.learnedToday(0, 0)).as("판정 문제가 없는 개념은 배울 수 없다").isFalse();
    }

    @Test
    void 늦게_확인해도_다음_간격은_확인한_날부터_센다() {
        LocalDate late = LEARNED.plusDays(10);
        assertThat(ReviewSchedule.afterCheck(1, true, late))
                .isEqualTo(new ReviewSchedule.Next(2, late.plusDays(4)));
    }

    @Test
    void 틀리면_한_단계_돌아가고_그_단계의_간격으로_다시_묻는다() {
        LocalDate day = LEARNED.plusDays(21);
        assertThat(ReviewSchedule.afterCheck(3, false, day))
                .isEqualTo(new ReviewSchedule.Next(2, day.plusDays(4)));
        assertThat(ReviewSchedule.afterCheck(2, false, day))
                .isEqualTo(new ReviewSchedule.Next(1, day.plusDays(3)));
    }

    @Test
    void 첫_재확인에서_틀려도_배운_날_단계_아래로는_내려가지_않는다() {
        LocalDate day = LEARNED.plusDays(3);
        assertThat(ReviewSchedule.afterCheck(1, false, day))
                .isEqualTo(new ReviewSchedule.Next(1, day.plusDays(3)));
    }

    @Test
    void 재확인_단계가_아니면_계산하지_않는다() {
        assertThatThrownBy(() -> ReviewSchedule.afterCheck(0, true, LEARNED))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ReviewSchedule.afterCheck(4, true, LEARNED))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
