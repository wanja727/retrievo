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
 * 기록 화면 (20장). 모두 실제 풀이·확인 기록에서 센 값이다. 예상치나 모델 값은 넣지 않는다 (1장 "숫자는 측정한 것만").
 * 비율은 맞힌 수와 전체 수를 함께 준다. 화면이 표본이 적은지 보고 판단한다.
 */
@RestController
@Transactional(readOnly = true)
public class ReportController {

    /** 꺼낸 날을 보여주는 기간: 최근 26주 */
    static final int ACTIVITY_DAYS = 26 * 7;

    private final JdbcClient jdbc;
    private final Clock clock;

    ReportController(JdbcClient jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    public record Rate(int correct, int total) {
    }

    /**
     * 기억 곡선의 점. learnedDay: 레슨에서 처음 낸 답의 정답률(배운 날). 다시 푼 답은 세지 않는다 (ADR-021).
     * day3·day7·day21: 그 단계의 재확인에서 맞힌 비율 (delayed_check.attempt_no 1·2·3)
     */
    public record Curve(Rate learnedDay, Rate day3, Rate day7, Rate day21) {
    }

    /** 개념의 단계별 수. learning = 배우는 중(0), passed1~3 = 통과한 확인 수, graduated = 졸업(4) */
    public record Stages(int learning, int passed1, int passed2, int passed3, int graduated) {
    }

    public record DayCount(LocalDate date, int count) {
    }

    /**
     * retrievals: 지금까지 낸 답 수(꺼낸 횟수).
     * activity: 최근 26주 동안 답을 낸 날과 그날 낸 답 수 (답이 없는 날은 빠진다)
     */
    public record Report(LocalDate today, Curve curve, Stages stages, int retrievals, List<DayCount> activity) {
    }

    @GetMapping("/api/me/report")
    public Report report(@CurrentUser long userId) {
        LocalDate today = ServiceDates.today(clock);
        return new Report(today, curve(userId), stages(userId), retrievals(userId), activity(userId, today));
    }

    private Curve curve(long userId) {
        Rate learned = jdbc.sql("""
                        select count(*) filter (where correct) as correct, count(*) as total
                        from answer_submission
                        where user_id = ? and not is_delayed_check and first_attempt
                        """)
                .param(userId)
                .query((rs, n) -> new Rate(rs.getInt("correct"), rs.getInt("total")))
                .single();
        Rate[] checks = {new Rate(0, 0), new Rate(0, 0), new Rate(0, 0)};
        jdbc.sql("""
                        select attempt_no, count(*) filter (where result = 'CORRECT') as correct, count(*) as total
                        from delayed_check
                        where user_id = ? and attempt_no between 1 and 3
                        group by attempt_no
                        """)
                .param(userId)
                .query(rs -> {
                    checks[rs.getInt("attempt_no") - 1] = new Rate(rs.getInt("correct"), rs.getInt("total"));
                });
        return new Curve(learned, checks[0], checks[1], checks[2]);
    }

    private Stages stages(long userId) {
        int[] counts = new int[5];
        jdbc.sql("select stage, count(*) as n from concept_progress where user_id = ? group by stage")
                .param(userId)
                .query(rs -> {
                    counts[rs.getInt("stage")] = rs.getInt("n");
                });
        return new Stages(counts[0], counts[1], counts[2], counts[3], counts[4]);
    }

    private int retrievals(long userId) {
        return jdbc.sql("select count(*) from answer_submission where user_id = ?")
                .param(userId).query(Integer.class).single();
    }

    private List<DayCount> activity(long userId, LocalDate today) {
        return jdbc.sql("""
                        select service_date, count(*) as n
                        from answer_submission
                        where user_id = ? and service_date > ?
                        group by service_date
                        order by service_date
                        """)
                .param(userId)
                .param(today.minusDays(ACTIVITY_DAYS))
                .query((rs, n) -> new DayCount(rs.getObject("service_date", LocalDate.class), rs.getInt("n")))
                .list();
    }
}
