# Retrievo 프론트엔드

Next.js 16(App Router) + TypeScript + Tailwind CSS v4로 만든 모바일 웹이다. 화면 시안과 디자인 규칙은 노션 설계 문서 20장과 ADR-018에 있다.

## 실행

```bash
pnpm install
pnpm dev
```

- 기본은 **목 API**다. 백엔드 없이 `http://localhost:3000`에서 오늘 화면과 꺼내기 흐름을 끝까지 볼 수 있다
- 실제 백엔드에 붙이려면 `.env.example`을 `.env.local`로 복사하고 `NEXT_PUBLIC_API_MODE=http`로 바꾼다. 백엔드는 `local` 프로필로 띄운다 (`X-Dev-User-Id` 임시 로그인)
- `/api/*` 요청은 `next.config.ts`의 rewrites가 `RETRIEVO_API_ORIGIN`(기본 `http://localhost:8080`)으로 보낸다. 브라우저에는 같은 도메인으로 보인다 (ADR-010)

## 검사

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 구조

| 경로 | 내용 |
| --- | --- |
| `src/app/` | 라우트. `/` 오늘, `/check` 오늘의 지연 확인 |
| `src/features/today/` | 오늘 화면, 첫 사용 안내 |
| `src/features/check/` | 답 먼저 적기 → 보기와 확신도 → 해설 |
| `src/components/ui/` | 버튼, 기억 기록 표시, 코드 블록, 확신도 탭, 하단 메뉴 |
| `src/lib/api/` | API 타입(백엔드 record와 같은 형식), 실제 클라이언트, 목 API |
| `src/lib/highlight.ts` | 코드 문제용 Java 신택스 하이라이터 |

## 디자인 규칙 (ADR-023)

- 컨셉은 흰 바탕에 가는 선, 그리고 라벤더 한 가지 색이다. 레슨 사이트(dev-lessons)의 `soft pastel` 테마와 같은 색이라, 한쪽을 바꾸면 다른 쪽도 맞춘다
- 라벤더(`accent`)는 테마 색이다: 누르는 버튼, 고른 보기, 진행 막대, 통과한 확인, 장기 기억
- 민트(`ok`)는 "맞았어요" 판정에만, 산호(`wrong`)는 틀림에만 쓴다. 주황(골드)은 쓰지 않는다
- 그림자, 번짐, 반투명은 쓰지 않는다. 묶음(`.card`)과 보기(`.tile`)는 흰 면에 가는 선, 하단 메뉴와 버튼 영역(`.bottom-bar`)은 화면 아래에 붙은 흰 면에 위쪽 선 하나이고, 대표 숫자 면(`.hero`)만 옅은 라벤더다
- 그라데이션 글자와 그라데이션 버튼은 쓰지 않는다. 큰 숫자는 짙은 글자색, 주 버튼과 채운 막대는 테마 색 한 가지다
- 하단 메뉴는 화면 아래에 붙인다. 내용이 목록이라 띄울 이유가 없다. 지금 화면은 옅은 라벤더 알약으로 표시한다
- 오늘 화면에는 쌓이기만 하는 값만 둔다: 오늘 꺼낸 수, 연속 학습, 배운 개념, 장기 기억 개념, 꺼낸 횟수. 내려갈 수 있는 비율은 기록 화면에만 둔다
- 개념과 레슨에는 기억 기록(배움 완료, 3일·7일·21일 기억)을 보여준다. 가장 길게 기억한 기록이라 틀려도 줄지 않는다. 뜻은 `src/lib/memory.ts`에 있다
- 지금 몇 번째 확인인지는 시스템이 관리하고 목록에는 보여주지 않는다
- 요소마다 이유가 있어야 한다. 이유를 댈 수 없는 효과는 넣지 않는다
- 색 토큰은 `src/app/globals.css`의 `@theme`에 있다
