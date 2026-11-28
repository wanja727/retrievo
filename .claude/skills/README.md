# 디자인 스킬

Retrievo 화면을 검토하고 다듬는 데 쓰는 외부 스킬이다. 원본을 고치지 않고 그대로 복사했다.
프로젝트의 디자인 규칙은 `docs/design.md`에 있다. 스킬의 권고와 부딪히면 그 문서가 이긴다.

| 스킬 | 하는 일 |
|---|---|
| `web-design-guidelines` | Vercel의 Web Interface Guidelines로 코드를 검사해 `파일:줄`로 보고한다 |
| `better-interface` | 아래 스킬들을 묶어 한 화면이나 흐름을 검토하고, 순위를 매긴 보고서 하나를 낸다 |
| `interface-review` | 브랜치나 커밋하지 않은 변경에서 화면이 나빠진 곳을 찾는다 (사용자가 부를 때만) |
| `better-accessibility` | 포커스, 키보드, ARIA, 폼, 확대, 터치 영역 (WCAG 2.2) |
| `better-layout` | 묶음, 정렬, 읽는 순서, 좁은 화면 |
| `better-colors` | 색 토큰의 역할, 대비 |
| `better-ui` | 모서리 곡률, 광학 정렬, 아이콘, hover |
| `better-motion` | 무엇을 움직일지, 시간과 easing 값 |

일부러 넣지 않은 것: Jakub Krehel의 `better-typography`, `better-writing`은 영어 UI 기준이라 뺐다.
`better-interface`는 이 두 분야를 "검토 안 함"으로 표시하고 넘어간다.

## 출처 (2026-11-28에 복사)

- `jakubkrehel/skills` 커밋 `672ae44ace6aaed65b86cbb1e2fd6fbea0e79578`, MIT (`LICENSE-jakubkrehel-skills`)
- `vercel-labs/agent-skills` 커밋 `5a37a6329fbad3666c3207392a6a7c0110e92efb`의 `skills/web-design-guidelines`, MIT (저장소 README에 적힘)

새 버전으로 바꿀 때는 원본에서 다시 복사하고, 명령 실행이나 외부 전송을 지시하는 내용이 없는지 읽어 본 뒤 위 커밋을 고친다.
