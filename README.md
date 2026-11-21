# Retrievo

> 꺼낼수록 지식이 쌓이는 인출 효과 기반 학습 서비스

AI에게 물으면 답은 바로 나오지만, 쉽게 얻은 답은 쉽게 잊는다. Retrievo(리트리보)는 답을 먼저 떠올리게 하고(인출 연습), 잊을 때쯤 다른 문제로 다시 묻는(간격 반복) 학습 앱이다. 첫 주제는 개발자 면접 대비다.

## 핵심 루프

1. **답 먼저:** 답을 내기 전에는 정답과 해설을 보여주지 않는다
2. **확신도:** 답을 내기 전에 확실 / 애매 / 모름을 고른다. "확실한데 틀린" 개념을 따로 모은다
3. **맞힐 때까지:** 레슨에서 틀린 문제는 다른 문제를 푼 뒤 다시 묻는다. 판정 문제를 모두 맞히면 배운 날로 친다
4. **지연 확인:** 배운 개념을 3일·7일·21일 뒤에 **다른 문제**로 다시 묻는다. 틀리면 한 단계 돌아가고 그날 다른 문제로 다시 배운다. 확실했는데 틀리면 다음 날 먼저 묻는다
5. **졸업:** 재확인 세 번을 모두 통과한 개념은 더는 묻지 않는다

## 구성

| 경로 | 내용 |
| --- | --- |
| `backend/` | Java 21, Spring Boot 3.5, JPA, PostgreSQL, Flyway. 모듈러 모놀리스 |
| `frontend/` | Next.js 16, TypeScript, Tailwind CSS v4. 모바일 웹. [frontend/README.md](frontend/README.md) |
| `docs/` | 문제 파일 형식 등 |

- 문제 원본은 이 저장소가 아니라 콘텐츠 저장소의 파일이다. 개발 주제는 [dev-lessons](https://github.com/wanja727/dev-lessons)
- 로그인은 OAuth만 쓴다. 비밀번호를 저장하지 않는다 (카카오 먼저)
- 프론트는 백엔드 없이도 목 API로 실행된다. 오늘 화면, 레슨, 지연 확인(보기와 확신도 → 해설), 기록 화면이 있다

## API

| 요청 | 내용 |
| --- | --- |
| `GET /api/lessons` | 레슨 목록 (단원·레슨 순서) |
| `GET /api/lessons/{id}/questions` | 레슨의 판정 문제. 정답과 해설은 담지 않는다 |
| `POST /api/submissions` | 답 제출. `clientSubmissionId`, `questionVersionId`, `selected`, `confidence`(SURE/UNSURE/UNKNOWN) 필수. 응답에서 처음으로 정답과 해설을 준다 |
| `GET /api/me/delayed-checks/today` | 오늘 확인할 개념과, 개념마다 처음과 다른 문제 하나. 확실했는데 틀린 개념이 먼저 온다. 답은 `mode: DELAYED_CHECK`로 제출 |
| `GET /api/me/concepts` | 풀어 본 개념의 진행 상태: 통과한 확인 수(0 = 배우는 중, 4 = 졸업), 다음 확인 날, 지금까지 도달한 가장 높은 단계(`bestStage`, 틀려도 줄지 않는다) |

| `GET /api/me` | 내 프로필: 닉네임, 가입한 날, 며칠째 |
| `GET /api/me/report` | 기록 화면: 배운 날·3·7·21일 정답률, 단계 분포, 확신도별 정답률, 최근 26주 꺼낸 날 |
| `GET /api/me/home` | 오늘 화면: 오늘 끝낸 확인과 전체, 연속 학습 일수, 이번 주에 답을 낸 날, 배운 개념 수, 장기 기억 개념 수, 꺼낸 횟수. 모두 쌓이기만 하는 값이다 (ADR-025) |
| `POST /api/logout` | 로그아웃 (204) |
| `GET /oauth2/authorization/kakao` | 카카오 로그인 시작. 끝나면 `RETRIEVO_PUBLIC_URL/`로 돌아간다 |

- **로그인:** 카카오 OAuth2만 쓴다. 비밀번호를 저장하지 않는다 (ADR-010). 로그인 상태는 세션 쿠키(`SESSION`)이고 세션은 Postgres(Spring Session JDBC)에 둔다. Redis를 따로 두지 않으려고 바꿨다
- **같은 도메인:** 프론트(Next.js)가 `/api/**`, `/oauth2/**`, `/login/oauth2/**`를 백엔드로 넘긴다. 브라우저에는 프론트 도메인 하나로 보여서 쿠키가 단순하다
- **CSRF:** 세션 쿠키를 쓰므로 켜 둔다. 서버가 `XSRF-TOKEN` 쿠키를 내려주고, 화면은 GET이 아닌 요청에 그 값을 `X-XSRF-TOKEN` 헤더로 보낸다
- **개발용 임시 로그인:** `retrievo.auth.dev-header=true`(local·test 프로필)일 때만 `X-Dev-User-Id` 헤더로 사용자를 정한다. 운영에서는 꺼져 있다
- 문제는 시작할 때 `retrievo.content.import-dir`의 YAML 파일에서 가져온다. 형식: [docs/content-format.md](docs/content-format.md)

## 실행

테스트는 Docker(Testcontainers)가 필요하다.

```bash
cd backend
gradle test
```

로컬에서 서버 띄우기 (JDK 21, Docker 필요):

1. 저장소 루트에서 `docker compose up -d`로 PostgreSQL을 띄운다 (DB·계정·비밀번호 `retrievo`)
2. IntelliJ에서 `backend`를 Gradle 프로젝트로 연다. Gradle 배포는 "래퍼 작업"(build.gradle의 8.14.3), Gradle JVM은 21
3. `RetrievoApplication`을 실행한다. 활성 프로필 `local`, 프로그램 인수 `--retrievo.content.import-dir=<dev-lessons>/content/questions`
4. 임시 로그인용 사용자를 넣는다: `docker compose exec postgres psql -U retrievo -d retrievo -c "insert into users (nickname) values ('me') returning id;"`
5. `curl -H "X-Dev-User-Id: 1" http://localhost:8080/api/lessons`로 확인한다

### 카카오 로그인 설정

1. [카카오 개발자](https://developers.kakao.com)에서 애플리케이션을 만든다
2. **카카오 로그인**을 켜고, Redirect URI에 `<프론트 주소>/login/oauth2/code/kakao`를 등록한다. 로컬은 `http://localhost:3000/login/oauth2/code/kakao`
3. **동의항목**에서 "닉네임(profile_nickname)"을 켠다. 받지 못하면 이름은 "학습자"로 만든다
4. **보안**에서 Client Secret을 만들고 사용 상태로 둔다
5. 백엔드 환경 변수: `KAKAO_CLIENT_ID`(REST API 키), `KAKAO_CLIENT_SECRET`, `RETRIEVO_PUBLIC_URL`(프론트 주소, 기본 `http://localhost:3000`). 키는 저장소에 넣지 않는다
6. 프론트는 `NEXT_PUBLIC_API_MODE=http`로 띄우고 `NEXT_PUBLIC_DEV_USER_ID`는 비워 둔다 (값이 있으면 로그인하지 않아도 그 사용자로 들어가서 로그인 화면을 볼 수 없다)

## 배포

Vercel(프론트) + Cloud Run 서울(백엔드) + Supabase 서울(DB). main에 백엔드 변경이 들어가면 GitHub Actions가 테스트 뒤 배포한다. 처음 설정과 운영 메모는 [docs/deploy.md](docs/deploy.md).
