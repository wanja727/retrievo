package app.retrievo.learning;

import app.retrievo.auth.CurrentUser;
import app.retrievo.common.ServiceDates;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 오늘 화면 (ADR-025). 쌓이기만 하는 값만 준다: 오늘 끝낸 확인, 연속 학습, 배운 개념, 장기 기억 개념, 꺼낸 횟수.
 * 내려갈 수 있는 비율(정답률)은 기록 화면({@link ReportController})에만 있다.
 * 모두 실제 풀이 기록에서 센 값이다.
 */
@RestController
@Transactional(readOnly = true)
public class HomeController {

    private final JdbcClient jdbc;
    private final Clock clock;

    HomeController(JdbcClient jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    /**
     * checksDone: 오늘 끝낸 확인 수. checksTotal: 끝낸 것과 남은 것을 더한 오늘 확인 전체.
     * streak: 답을 낸 날이 이어진 일수. 오늘 아직 답을 내지 않았으면 어제까지 센 값.
     * activeDates: 이번 주(월~일) 가운데 답을 낸 날.
     * learned: 학습을 마친 개념 수. longTerm: 21일 뒤에도 기억한 개념 수. retrievals: 지금까지 낸 답 수
     */
    public record Home(LocalDate today, int checksDone, int checksTotal, int streak, List<LocalDate> activeDates,
            int learned, int longTerm, int retrievals) {
    }

    @GetMapping("/api/me/home")
    public Home home(@CurrentUser long userId) {
        LocalDate today = ServiceDates.today(clock);
        int done = jdbc.sql("""
                        select count(*) from answer_submission
                        where user_id = ? and service_date = ? and is_delayed_check
                        """)
                .params(userId, today).query(Integer.class).single();
        int due = jdbc.sql("select count(*) from concept_progress where user_id = ? and due_date <= ?")
                .params(userId, today).query(Integer.class).single();

        List<LocalDate> dates = jdbc.sql("""
                        select distinct service_date from answer_submission where user_id = ? order by service_date
                        """)
                .param(userId).query(LocalDate.class).list();
        LocalDate weekStart = Streaks.weekStart(today);
        List<LocalDate> thisWeek = dates.stream().filter(d -> !d.isBefore(weekStart)).toList();

        record Counts(int learned, int longTerm) {
        }
        Counts counts = jdbc.sql("""
                        select count(*) filter (where best_stage >= 1) as learned,
                               count(*) filter (where best_stage >= 4) as long_term
                        from concept_progress where user_id = ?
                        """)
                .param(userId)
                .query((rs, n) -> new Counts(rs.getInt("learned"), rs.getInt("long_term")))
                .single();
        int retrievals = jdbc.sql("select count(*) from answer_submission where user_id = ?")
                .param(userId).query(Integer.class).single();

        return new Home(today, done, done + due, Streaks.count(dates, today), thisWeek, counts.learned(),
                counts.longTerm(), retrievals);
    }
}
