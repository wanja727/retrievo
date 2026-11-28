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
 * 오늘 화면 (ADR-025). 오늘 끝낸 확인, 연속 학습, 이번 주에 푼 문제, 최근 기억률, 배운 개념, 장기 기억 개념, 꺼낸 횟수.
 * 최근 기억률은 내려갈 수 있는 값이지만 복습하면 회복되는 최근 30일 값이라 오늘 화면에 둔다 (2026-11-28 결정).
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
     * learned: 학습을 마친 개념 수. longTerm: 21일 뒤에도 기억한 개념 수. retrievals: 지금까지 낸 답 수.
     * weekSolved: 이번 주(월~일)에 답을 낸 날과 그날 낸 답 수. 답이 없는 날은 빠진다.
     * recall: 최근 30일(오늘 포함) 동안 지연 확인에서 맞힌 수와 전체 수. 비율은 화면이 계산한다
     */
    public record Home(LocalDate today, int checksDone, int checksTotal, int streak, List<LocalDate> activeDates,
            int learned, int longTerm, int retrievals, List<ReportController.DayCount> weekSolved,
            ReportController.Rate recall) {
    }

    /** 최근 기억률을 세는 기간. 오늘을 포함한 날 수 */
    static final int RECALL_DAYS = 30;

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

        List<ReportController.DayCount> weekSolved = jdbc.sql("""
                        select service_date, count(*) as solved from answer_submission
                        where user_id = ? and service_date >= ?
                        group by service_date order by service_date
                        """)
                .params(userId, weekStart)
                .query((rs, n) -> new ReportController.DayCount(rs.getObject("service_date", LocalDate.class),
                        rs.getInt("solved")))
                .list();
        ReportController.Rate recall = jdbc.sql("""
                        select count(*) filter (where correct) as correct, count(*) as total
                        from answer_submission
                        where user_id = ? and is_delayed_check and service_date > ?
                        """)
                .params(userId, today.minusDays(RECALL_DAYS))
                .query((rs, n) -> new ReportController.Rate(rs.getInt("correct"), rs.getInt("total")))
                .single();

        return new Home(today, done, done + due, Streaks.count(dates, today), thisWeek, counts.learned(),
                counts.longTerm(), retrievals, weekSolved, recall);
    }
}
