package app.retrievo.content;

import static org.assertj.core.api.Assertions.assertThat;

import app.retrievo.support.TestcontainersConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * 시작할 때 문제 파일을 가져오는지 본다. 가져오기는 애플리케이션이 뜨는 도중에(요청을 받기 전에) 끝나야 한다.
 * 그래서 테스트가 시작됐을 때는 이미 문제가 들어 있다. 다른 통합 테스트처럼 테이블을 비우지 않는다.
 */
@SpringBootTest(properties = "retrievo.content.import-dir=src/test/resources/content")
@ActiveProfiles("test")
@Import(TestcontainersConfig.class)
class ContentImportRunnerTest {

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    ContentImportRunner runner;

    @Test
    void 애플리케이션이_뜨면_문제_파일이_이미_들어와_있다() {
        assertThat(jdbc.queryForObject(
                "select count(*) from question where external_key like 'dev/n-plus-1/%'", Integer.class)).isEqualTo(4);
        assertThat(jdbc.queryForObject(
                "select count(*) from question_version v join question q on q.id = v.question_id"
                        + " where q.external_key like 'dev/n-plus-1/%'", Integer.class)).isEqualTo(4);
    }

    @Test
    void 문제_파일과_빌드가_같으면_다시_가져오지_않고_다르면_다시_가져온다() {
        String key = "dev/n-plus-1/%";
        assertThat(jdbc.queryForObject("select count(*) from content_import_state", Integer.class)).isEqualTo(1);

        // DB의 값을 손으로 바꾼 뒤 다시 시작한 것처럼 돌린다. 지난번과 같으므로 건너뛰어 값이 그대로 남는다
        jdbc.update("update question set sort_order = 99 where external_key like ?", key);
        runner.afterSingletonsInstantiated();
        assertThat(jdbc.queryForObject(
                "select count(*) from question where external_key like ? and sort_order = 99", Integer.class, key))
                .isEqualTo(4);

        // 지난번 상태가 다르면(파일이나 빌드가 바뀐 것과 같다) 다시 가져와 파일의 값으로 돌아간다
        jdbc.update("update content_import_state set fingerprint = 'old'");
        runner.afterSingletonsInstantiated();
        assertThat(jdbc.queryForObject(
                "select count(*) from question where external_key like ? and sort_order = 99", Integer.class, key))
                .isZero();
        assertThat(jdbc.queryForObject("select fingerprint from content_import_state", String.class))
                .isNotEqualTo("old");
    }
}
