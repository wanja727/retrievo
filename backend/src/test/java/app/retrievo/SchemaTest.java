package app.retrievo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.retrievo.support.IntegrationTest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

class SchemaTest extends IntegrationTest {

    @Test
    void Flyway가_테이블을_만든다() {
        List<String> tables = jdbc.queryForList("""
                select table_name from information_schema.tables
                where table_schema = 'public' and table_name <> 'flyway_schema_history'
                order by table_name
                """, String.class);

        assertThat(tables).containsExactly(
                "answer_submission", "concept", "concept_progress", "content_import_state", "delayed_check", "lesson", "question",
                "question_version", "spring_session", "spring_session_attributes", "subject", "unit", "user_identity",
                "users");
    }

    @Test
    void 사용자_테이블에는_비밀번호_열이_없다() {
        List<String> columns = jdbc.queryForList("""
                select column_name from information_schema.columns
                where table_name in ('users', 'user_identity')
                """, String.class);

        assertThat(columns).isNotEmpty().noneMatch(c -> c.contains("password"));
    }

    @Test
    void 같은_로그인_수단은_두_사용자에게_연결할_수_없다() {
        long a = createUser("a");
        long b = createUser("b");
        jdbc.update("insert into user_identity (user_id, provider, provider_user_id) values (?, 'KAKAO', '42')", a);

        assertThatThrownBy(() -> jdbc.update(
                "insert into user_identity (user_id, provider, provider_user_id) values (?, 'KAKAO', '42')", b))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
