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

    @Test
    void 애플리케이션이_뜨면_문제_파일이_이미_들어와_있다() {
        assertThat(jdbc.queryForObject(
                "select count(*) from question where external_key like 'dev/n-plus-1/%'", Integer.class)).isEqualTo(4);
        assertThat(jdbc.queryForObject(
                "select count(*) from question_version v join question q on q.id = v.question_id"
                        + " where q.external_key like 'dev/n-plus-1/%'", Integer.class)).isEqualTo(4);
    }
}
