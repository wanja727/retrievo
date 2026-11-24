package app.retrievo.learning;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * 사용자별 개념 진행 상태(concept_progress)와 확인 기록(delayed_check). 단계 계산은 {@link ReviewSchedule}이 한다.
 * 같은 사용자의 같은 개념에 답이 동시에 와도 단계가 두 번 오르지 않도록 진행 상태 행을 잠그고 바꾼다.
 */
@Repository
class ConceptProgresses {

    private final JdbcClient jdbc;

    ConceptProgresses(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** 오늘 확인할 개념. learnedOn은 배운 날 기준을 통과한 날 */
    record Due(long conceptId, String conceptName, int stage, LocalDate dueDate, LocalDate learnedOn) {
    }

    /** 개념 하나의 진행 상태 (레슨·기록 화면용). bestStage는 지금까지 도달한 가장 높은 단계 (ADR-025) */
    record Progress(long conceptId, String conceptName, long lessonId, String lessonTitle, int stage, int bestStage,
            LocalDate learnedOn, LocalDate dueDate, Instant graduatedAt) {
    }

    /**
     * 레슨에서 낸 답을 반영한다. 처음 푼 개념이면 배우는 중(0단계)으로 만들고,
     * 배우는 중인 개념의 배운 날 문제(lesson_day)를 오늘 모두 한 번씩 맞혔으면 1단계로 올려 3일 뒤 확인을 잡는다 (ADR-021).
     * 틀린 문제는 화면이 다시 내므로, 맞힐 때까지 풀면 그날 기준을 넘는다.
     * 이미 1단계 이상인 개념은 레슨에서 다시 풀어도 일정이 바뀌지 않는다.
     */
    void recordLessonAnswer(long userId, long conceptId, boolean correct, LocalDate today, Instant now) {
        jdbc.sql("""
                        insert into concept_progress (user_id, concept_id, stage, updated_at)
                        values (?, ?, 0, ?)
                        on conflict do nothing
                        """)
                .params(userId, conceptId, Timestamp.from(now))
                .update();
        if (!correct) {
            return;
        }
        int stage = lockStage(userId, conceptId);
        if (stage != ReviewSchedule.LEARNING) {
            return;
        }
        // 배운 날에 푸는 판정 문제 수와, 그중 오늘 맞힌 문제 수. 방금 저장한 이 답도 센다 (같은 트랜잭션)
        record Count(int total, int correctToday) {
        }
        Count count = jdbc.sql("""
                        select count(*) as total,
                               count(*) filter (where exists (
                                   select 1 from answer_submission s
                                   join question_version v on v.id = s.question_version_id
                                   where v.question_id = q.id and s.user_id = ? and s.service_date = ?
                                     and s.correct and not s.is_delayed_check
                               )) as correct_today
                        from question q
                        where q.concept_id = ? and q.status = 'REVIEWED' and q.purpose = 'JUDGMENT'
                          and q.lesson_day
                        """)
                .params(userId, today, conceptId)
                .query((rs, n) -> new Count(rs.getInt("total"), rs.getInt("correct_today")))
                .single();
        if (ReviewSchedule.learnedToday(count.total(), count.correctToday())) {
            ReviewSchedule.Next next = ReviewSchedule.learned(today);
            jdbc.sql("""
                            update concept_progress
                            set stage = ?, best_stage = greatest(best_stage, ?), learned_on = ?, due_date = ?,
                                updated_at = ?
                            where user_id = ? and concept_id = ?
                            """)
                    .params(next.stage(), next.stage(), today, next.dueDate(), Timestamp.from(now), userId, conceptId)
                    .update();
        }
    }

    /** 잠근 재확인 대상. stage는 확인 전 단계(1~3) */
    record Scheduled(int stage, LocalDate dueDate) {
    }

    /** 오늘까지 확인이 예정된 개념이면 잠그고 현재 단계와 예정일을 돌려준다 */
    Optional<Scheduled> lockDue(long userId, long conceptId, LocalDate today) {
        return jdbc.sql("""
                        select stage, due_date from concept_progress
                        where user_id = ? and concept_id = ? and due_date <= ?
                        for update
                        """)
                .params(userId, conceptId, today)
                .query((rs, n) -> new Scheduled(rs.getInt("stage"), rs.getObject("due_date", LocalDate.class)))
                .optional();
    }

    /** 재확인 결과를 반영하고 확인 기록을 남긴다 */
    void recordCheck(long userId, long conceptId, Scheduled before, ReviewSchedule.Next next, boolean correct,
            long questionVersionId, Instant now) {
        jdbc.sql("""
                        update concept_progress
                        set stage = ?, best_stage = greatest(best_stage, ?), due_date = ?, updated_at = ?,
                            graduated_at = case when ? then ? else graduated_at end
                        where user_id = ? and concept_id = ?
                        """)
                .params(next.stage(), next.stage(), next.dueDate(), Timestamp.from(now),
                        next.graduated(), Timestamp.from(now), userId, conceptId)
                .update();
        jdbc.sql("""
                        insert into delayed_check
                            (user_id, concept_id, attempt_no, due_date, result, checked_at, question_version_id, stage_after)
                        values (?, ?, ?, ?, ?, ?, ?, ?)
                        """)
                .params(userId, conceptId, before.stage(), before.dueDate(), correct ? "CORRECT" : "WRONG",
                        Timestamp.from(now), questionVersionId, next.stage())
                .update();
    }

    /** 오늘 확인할 개념. 오래 밀린 순 */
    List<Due> due(long userId, LocalDate today) {
        return jdbc.sql("""
                        select p.concept_id, c.name, p.stage, p.due_date, p.learned_on
                        from concept_progress p join concept c on c.id = p.concept_id
                        where p.user_id = ? and p.due_date <= ?
                        order by p.due_date, p.concept_id
                        """)
                .params(userId, today)
                .query((rs, n) -> new Due(
                        rs.getLong("concept_id"), rs.getString("name"), rs.getInt("stage"),
                        rs.getObject("due_date", LocalDate.class), rs.getObject("learned_on", LocalDate.class)))
                .list();
    }

    /** 사용자가 풀어 본 모든 개념의 진행 상태. 레슨 순서대로 */
    List<Progress> all(long userId) {
        return jdbc.sql("""
                        select p.concept_id, c.name, l.id as lesson_id, l.title as lesson_title, p.stage,
                               p.best_stage, p.learned_on, p.due_date, p.graduated_at
                        from concept_progress p
                        join concept c on c.id = p.concept_id
                        join lesson l on l.id = c.lesson_id
                        join unit u on u.id = l.unit_id
                        where p.user_id = ?
                        order by u.sort_order, l.sort_order, l.id, c.id
                        """)
                .param(userId)
                .query((rs, n) -> {
                    Timestamp graduatedAt = rs.getTimestamp("graduated_at");
                    return new Progress(
                            rs.getLong("concept_id"), rs.getString("name"), rs.getLong("lesson_id"),
                            rs.getString("lesson_title"), rs.getInt("stage"), rs.getInt("best_stage"),
                            rs.getObject("learned_on", LocalDate.class), rs.getObject("due_date", LocalDate.class),
                            graduatedAt == null ? null : graduatedAt.toInstant());
                })
                .list();
    }

    /** 이 사용자가 이 문제(버전과 상관없이)를 레슨이나 연습에서 이미 푼 적이 있는지. 지연 확인 답은 세지 않는다 */
    boolean answeredBefore(long userId, long questionVersionId) {
        return jdbc.sql("""
                        select exists (
                            select 1 from answer_submission s
                            join question_version v on v.id = s.question_version_id
                            where s.user_id = ? and not s.is_delayed_check
                              and v.question_id = (select question_id from question_version where id = ?)
                        )
                        """)
                .params(userId, questionVersionId)
                .query(Boolean.class)
                .single();
    }

    /** 배운 날 기준을 넘은 개념인지 (1단계 이상, 졸업 포함) */
    boolean learned(long userId, long conceptId) {
        return jdbc.sql("""
                        select exists (
                            select 1 from concept_progress where user_id = ? and concept_id = ? and stage >= 1
                        )
                        """)
                .params(userId, conceptId)
                .query(Boolean.class)
                .single();
    }

    /** 이 개념에서 지금까지 도달한 가장 높은 단계. 아직 풀어 본 적이 없으면 0 */
    int bestStage(long userId, long conceptId) {
        return jdbc.sql("select best_stage from concept_progress where user_id = ? and concept_id = ?")
                .params(userId, conceptId)
                .query(Integer.class)
                .optional()
                .orElse(0);
    }

    /** 지금까지 낸 답 수 */
    int retrievals(long userId) {
        return jdbc.sql("select count(*) from answer_submission where user_id = ?")
                .param(userId).query(Integer.class).single();
    }

    private int lockStage(long userId, long conceptId) {
        return jdbc.sql("select stage from concept_progress where user_id = ? and concept_id = ? for update")
                .params(userId, conceptId)
                .query(Integer.class)
                .single();
    }
}
