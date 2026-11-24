package app.retrievo.content;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 콘텐츠 조회. 사용자에게는 검수 완료(REVIEWED)된 판정 문제만 보인다.
 * 레슨에서는 그 가운데 배운 날에 푸는 문제(lesson_day)만 묻고, 나머지는 지연 확인에서 묻는다.
 * 연습(서술형) 문제는 자기 채점 화면을 만들 때 연다.
 */
@Service
@Transactional(readOnly = true)
public class LessonQueryService {

    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {
    };

    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public LessonQueryService(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    /** key: 주제를 뺀 레슨 키. dev-lessons의 레슨 slug와 같다 (예: jpa-n-plus-1). questionCount: 배운 날에 푸는 문제 수 */
    public record LessonSummary(long id, String key, String unit, String title, int questionCount) {
    }

    /** 레슨 하나와 본문 7단계. 본문이 아직 없으면 steps가 null이다 (화면이 레슨 사이트로 연결한다) */
    public record LessonDetail(long id, String key, String unit, String title, int questionCount, JsonNode steps) {
    }

    public LessonDetail detail(long lessonId) {
        return jdbc.sql("""
                        select l.id, l.external_key, u.title as unit, l.title, l.body,
                               (select count(*) from question q
                                where q.lesson_id = l.id and q.status = 'REVIEWED' and q.purpose = 'JUDGMENT'
                                  and q.lesson_day)
                                   as question_count
                        from lesson l join unit u on u.id = l.unit_id
                        where l.id = ?
                        """)
                .param(lessonId)
                .query((rs, n) -> new LessonDetail(
                        rs.getLong("id"), lessonSlug(rs.getString("external_key")), rs.getString("unit"),
                        rs.getString("title"), rs.getInt("question_count"), readBody(rs.getString("body"))))
                .optional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "없는 레슨이다"));
    }

    private JsonNode readBody(String body) {
        if (body == null) {
            return null;
        }
        try {
            return json.readTree(body);
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException("레슨 본문 JSON을 읽을 수 없다", e);
        }
    }

    public List<LessonSummary> list() {
        return jdbc.sql("""
                        select l.id, l.external_key, u.title as unit, l.title,
                               (select count(*) from question q
                                where q.lesson_id = l.id and q.status = 'REVIEWED' and q.purpose = 'JUDGMENT'
                                  and q.lesson_day)
                                   as question_count
                        from lesson l join unit u on u.id = l.unit_id
                        order by u.sort_order, l.sort_order, l.id
                        """)
                .query((rs, n) -> new LessonSummary(
                        rs.getLong("id"), lessonSlug(rs.getString("external_key")), rs.getString("unit"), rs.getString("title"), rs.getInt("question_count")))
                .list();
    }

    /** 가져올 때 레슨 키는 "주제/레슨"이다 (ContentImporter). 화면에는 레슨 부분만 준다 */
    static String lessonSlug(String externalKey) {
        return externalKey.substring(externalKey.indexOf('/') + 1);
    }

    /** 레슨에서 푸는 문제: 배운 날에 푸는 판정 문제 */
    public List<QuestionView> questions(long lessonId) {
        boolean exists = jdbc.sql("select exists (select 1 from lesson where id = ?)")
                .param(lessonId).query(Boolean.class).single();
        if (!exists) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "없는 레슨이다");
        }
        return jdbc.sql("""
                        select qv.id, q.concept_id, qv.type, qv.body, qv.code, qv.choices
                        from question q join question_version qv on qv.id = q.current_version_id
                        where q.lesson_id = ? and q.status = 'REVIEWED' and q.purpose = 'JUDGMENT'
                          and q.lesson_day
                        order by q.sort_order, q.id
                        """)
                .param(lessonId)
                .query((rs, n) -> toView(rs))
                .list();
    }

    /**
     * 졸업 확인 때 동료에게 가르치듯 말해 볼 질문과 자기 채점 항목. 개념의 검수 완료된 서술형(연습) 문제에서 고른다.
     * 판정에는 쓰지 않는다. 졸업은 판정 문제로 정한다 (ADR-007)
     */
    public record TeachPrompt(long questionVersionId, String body, List<String> checklist) {
    }

    public Optional<TeachPrompt> teachPrompt(long conceptId) {
        return jdbc.sql("""
                        select qv.id, qv.body, qv.checklist
                        from question q join question_version qv on qv.id = q.current_version_id
                        where q.concept_id = ? and q.status = 'REVIEWED' and q.purpose = 'PRACTICE'
                          and qv.checklist is not null
                        order by q.sort_order, q.id
                        limit 1
                        """)
                .param(conceptId)
                .query((rs, n) -> {
                    try {
                        return new TeachPrompt(rs.getLong("id"), rs.getString("body"),
                                json.readValue(rs.getString("checklist"), STRING_LIST));
                    } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
                        throw new IllegalStateException("체크리스트 JSON을 읽을 수 없다", e);
                    }
                })
                .optional();
    }

    /** 개념에서 지연 확인에 낼 문제 하나. 사용자가 아직 안 푼 문제를 먼저, 다 풀었으면 가장 오래전에 푼 문제 */
    public Optional<QuestionView> questionForDelayedCheck(long userId, long conceptId) {
        return jdbc.sql("""
                        select qv.id, q.concept_id, qv.type, qv.body, qv.code, qv.choices
                        from question q
                        join question_version qv on qv.id = q.current_version_id
                        left join (
                            select v.question_id, max(s.submitted_at) as last_at
                            from answer_submission s join question_version v on v.id = s.question_version_id
                            where s.user_id = ?
                            group by v.question_id
                        ) seen on seen.question_id = q.id
                        where q.concept_id = ? and q.status = 'REVIEWED' and q.purpose = 'JUDGMENT'
                        order by seen.last_at nulls first, q.sort_order, q.id
                        limit 1
                        """)
                .param(userId)
                .param(conceptId)
                .query((rs, n) -> toView(rs))
                .optional();
    }

    private QuestionView toView(ResultSet rs) throws SQLException {
        String choices = rs.getString("choices");
        try {
            return new QuestionView(
                    rs.getLong("id"),
                    rs.getLong("concept_id"),
                    QuestionType.valueOf(rs.getString("type")),
                    rs.getString("body"),
                    rs.getString("code"),
                    choices == null ? null : json.readValue(choices, STRING_LIST));
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException("보기 JSON을 읽을 수 없다: " + choices, e);
        }
    }
}
