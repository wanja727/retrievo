# 문제 파일 형식

Retrievo의 문제 원본은 콘텐츠 저장소의 YAML 파일이다. 개발 주제는 [dev-lessons](https://github.com/wanja727/dev-lessons)에 둔다. 파일 하나가 레슨 하나다. 앱은 시작할 때 이 파일들을 서비스 DB로 가져온다.

- 커밋 = 문제 버전, PR 리뷰 = 검수, CI = 형식 검사
- 주제와 상관없는 형식이다. 다른 영역(수학 등)도 같은 형식으로 각자의 콘텐츠 저장소에 둔다

## 예시

```yaml
subject:
  key: dev            # 주제 키. 영문 소문자·숫자·하이픈
  name: 개발자 면접

lesson:
  key: n-plus-1       # 레슨 키. dev-lessons의 레슨 slug와 같게 둔다
  title: N+1 문제
  unit: JPA           # 단원 이름
  order: 6            # 레슨 순서. 단원 순서는 가장 앞선 레슨의 순서를 따른다

concepts:             # 지연 확인은 개념 단위로 다른 문제를 골라 묻는다
  - key: lazy-loop
    name: 지연 로딩 컬렉션을 루프에서 읽을 때 생기는 추가 쿼리

coreQuestions:        # 선택. 레슨이 답하는 핵심 질문
  - key: q1
    text: N+1 문제는 무엇이고 왜 생기나요?

questions:
  - key: lazy-loop-count
    concept: lazy-loop
    coreQuestion: q1  # coreQuestions의 키. 이 문제의 근거가 되는 질문
    type: multiple_choice
    status: reviewed
    difficulty: 2
    body: 팀 10개를 조회한 뒤 각 팀의 members(LAZY)를 루프에서 읽으면 SELECT는 모두 몇 번일까?
    choices: [1번, 2번, 10번, 11번]
    answer: 4         # 보기 번호, 1부터
    explanation: 팀 목록 1번, 팀마다 members 1번씩 10번. 합쳐서 11번이다.
    source: https://docs.jboss.org/hibernate/orm/6.6/userguide/html_single/Hibernate_User_Guide.html#fetching
```

## 문제 항목

| 항목 | 필수 | 설명 |
| --- | --- | --- |
| `key` | 예 | 레슨 안에서 고유. 가져올 때 `주제/레슨/키`가 전역 키가 된다. **한 번 정하면 바꾸지 않는다** (바꾸면 다른 문제로 본다) |
| `concept` | 예 | `concepts`의 키 |
| `coreQuestion` | 조건부 | `coreQuestions`의 키, 또는 핵심 질문 전체를 아우르는 문제면 `all`. 파일에 `coreQuestions`가 있으면 필수이고, 없으면 쓸 수 없다 |
| `type` | 예 | `multiple_choice`, `ox`, `code_predict`, `line_pick`, `descriptive` |
| `status` | 아니오 | `draft`(기본), `reviewed`, `hidden`. 사용자에게는 `reviewed`만 보인다 |
| `difficulty` | 예 | 1~3 |
| `body` | 예 | 질문 |
| `code` | 형태별 | 질문과 함께 보여줄 코드. 줄 고르기는 필수이고, 줄 번호는 적지 않는다 (화면이 붙인다) |
| `choices` | 형태별 | 객관식·코드 예측: 2개 이상 |
| `answer` | 형태별 | 객관식·코드 예측: 보기 번호(1부터). OX: `O` 또는 `X`. 줄 고르기: 줄 번호를 쉼표로 (`"7, 8"`) |
| `checklist` | 형태별 | 서술형: 자기 채점 항목 4~5개 권장 |
| `explanation` | 예 | 답을 낸 뒤에만 보여주는 해설 |
| `source` | 권장 | 근거(공식 문서 링크). 검수 완료 문제에 없으면 경고 |

## 핵심 질문 (`coreQuestions`, 선택)

레슨이 답하는 핵심 질문을 적고, 문제마다 어느 질문에서 나왔는지 `coreQuestion`으로 묶는다. 문제의 근거가 레슨 어디에 있는지 파일만 보고 알 수 있게 하고, 질문마다 문제가 충분한지 기계로 셀 수 있게 하려는 것이다.

| 항목 | 필수 | 설명 |
| --- | --- | --- |
| `key` | 예 | 파일 안에서 고유. 영문 소문자, 숫자, 하이픈. `all`은 쓸 수 없다. dev-lessons에서는 레슨 페이지의 장 id(`q1`, `q2`)와 같게 둔다 |
| `text` | 예 | 질문 문장 |

- 선택 항목이다. 적지 않은 파일은 지금까지와 똑같이 검사한다
- 적은 파일은 모든 문제에 `coreQuestion`이 있어야 한다. 없는 키를 가리키면 오류다
- 질문 여럿을 한꺼번에 묻는 문제(예: 면접 답변 전체)는 `coreQuestion: all`로 적는다
- `concepts`와는 다르다. 개념은 앱이 지연 확인을 하는 단위이고, 핵심 질문은 문제의 근거를 묶는 표시다. 앱은 핵심 질문을 저장하지 않고, 바꿔도 문제의 새 버전이 생기지 않는다

## 형태와 용도

| type | 용도 | 채점 |
| --- | --- | --- |
| `multiple_choice` | 판정 | 자동 (보기 번호) |
| `ox` | 판정 | 자동 (O/X) |
| `code_predict` | 판정 | 자동 (보기 번호). 정답은 dev-lessons의 검증 테스트로 증명할 수 있다 |
| `line_pick` | 판정 | 자동 (고른 줄 번호 집합이 정답과 같아야 정답). 라인 고르기·버그 찾기 |
| `descriptive` | 연습 | 체크리스트 자기 채점 (4개 이상 정답 / 2~3개 부분 / 1개 이하 오답) |

- 용도는 형태에서 정해진다. 따로 적지 않는다
- 지연 확인(3일·7일·21일 뒤)은 **판정 문제로만** 한다. 처음 푼 문제와 다른 문제를 내야 하므로 개념마다 검수 완료된 판정 문제가 2개 이상 있어야 한다. 모자라면 가져올 때 경고한다

## 레슨 본문 (`steps`, 선택)

> 앱은 이제 `steps`를 화면에 쓰지 않는다. 모든 레슨은 레슨 사이트(dev-lessons의 대화형 페이지)를 앱 안에 그대로 띄우고, 그 아래에 문제 풀기 버튼을 둔다. 단계형 본문 화면은 앱에서 지웠다. 아래 형식은 백엔드가 아직 받아들이는 형식으로만 남아 있다.

레슨 본문 7단계를 같은 파일의 `steps`에 쓸 수 있다. 핵심 질문 구조로 쓴 레슨(2026-11-21부터의 레슨 표준)은 `steps`를 쓰지 않는다. 순서는 레슨 표준과 같다: 예측 → 배경 → 실습 → 함정 → 해결 → 확인 → 면접 답변. **확인** 단계는 이 파일의 판정 문제를 그대로 풀어서 따로 적지 않는다.

단계마다 다음 단계로 넘어가기 전에 스스로 꺼내 보는 장치가 하나 있다.

| 단계 | 항목 | 다음 단계를 여는 장치 |
| --- | --- | --- |
| `predict` 예측 | `question`, `text`(선택), `code`(선택), `choices`, `answer` | 결과를 고른다. 함정 단계에서 내 예측과 실제를 나란히 보여준다 |
| `background` 배경 | 설명 항목(아래) | `quiz` 또는 `recall` |
| `practice` 실습 | `title`, `text`, `code`(선택), `runs`, `after`(선택) | 실행마다 결과를 먼저 고르면 실제 결과(`output`)가 열린다 |
| `pitfall` 함정 | 설명 항목 | `quiz` 또는 `recall` |
| `fix` 해결 | 설명 항목 | `quiz` 또는 `recall` |
| `interview` 면접 답변 | `question`, `points`(2개 이상, `label`·`text`) | 먼저 말하거나 적은 뒤 모범 답변의 뼈대와 비교해 말한 항목만 체크한다 |

- **설명 항목:** `title`, `text`, `code`·`codeNote`(선택), `flow`(선택, 번호 붙은 단계 목록. 도식 대신), `alternatives`(선택, `title`·`note`. 다른 방법과 주의할 점), 그리고 `quiz`(`question`·`choices`·`answer`)와 `recall`(`prompt`·`answer`: 보지 않고 한 문장으로 답한 뒤 보여줄 예시 답) 중 **하나만**
- **실습 `runs`:** `call`(무엇을 실행했는지), `note`(선택), `choices`·`answer`(결과 예상 보기), `output`(실제 결과). 숫자는 검증 테스트로 확인한 값만 쓴다
- **글:** `text`는 빈 줄로 문단을 나누고 `**굵게**`와 `` `코드` ``만 쓴다. HTML은 해석하지 않는다
- 본문 속 정답(`predict`, `quiz`, `runs`)은 판정에 쓰지 않는 연습이라 화면에 함께 보낸다. 지연 확인과 배운 날 기준은 판정 문제로만 정한다
- 대화형 위젯(시뮬레이터, SVG 도식)은 옮기지 않는다. 코드 블록, `flow`, 실습 결과로 바꿔 쓴다
- 검사: 일곱 단계(확인 제외 여섯 항목)가 모두 있어야 하고, 보기 번호가 범위 안이어야 하며, `quiz`와 `recall`은 하나만 둔다

```yaml
steps:
  predict:
    question: 이 코드가 실행되는 동안 DB에 SQL을 몇 번 보낼까요?
    code: |-
      teamRepository.findAll().forEach(t -> t.getMembers().size());
    choices: [1번, 2번, 11번]
    answer: 3
  background:
    title: 필요할 때 채우는 빈 상자
    text: |-
      **지연 로딩(LAZY)**은 멤버 자리에 빈 상자만 넣어 둬요.

      상자를 처음 열 때(`size()`) SQL을 보내요.
    quiz:
      question: LAZY 컬렉션은 언제 SQL을 보낼까요?
      choices: [조회할 때, 처음 열 때]
      answer: 2
  practice:
    title: 쿼리를 직접 세어 봐요
    text: 결과를 먼저 예상해요.
    runs:
      - call: LAZY · 멤버에 접근
        choices: [1번, 11번]
        answer: 2
        output: 11번 · 팀 목록 1번 + 팀마다 1번씩
  pitfall:
    title: EAGER는 시점을 앞당길 뿐이에요
    text: JPQL은 적힌 대로 번역되고 연관 로딩은 따로 일어나요.
    flow: [팀만 조회 (1번), 팀마다 멤버 조회 (10번)]
    recall:
      prompt: EAGER로 바꿔도 N+1이 그대로인 이유를 한 문장으로 말해 보세요.
      answer: JPQL이 팀만 조회하고, 연관은 그 뒤에 팀마다 따로 채우기 때문이에요.
  fix:
    title: 한꺼번에 가져와요
    text: fetch join으로 팀과 멤버를 한 번에 가져와요.
    alternatives:
      - {title: 배치 페치, note: IN 절로 묶어 가져와요. 페이징과 함께 쓸 수 있어요}
    recall:
      prompt: fetch join으로 쿼리가 1번이 되는 이유는?
      answer: join한 SQL 한 번으로 함께 가져오기 때문이에요.
  interview:
    question: JPA N+1 문제에 대해 설명해 주세요.
    points:
      - {label: 정의, text: 목록 1번 뒤에 N번이 더 나간다}
      - {label: 해결, text: fetch join, @EntityGraph, 배치 페치}
```

## 형식 검사 (콘텐츠 저장소 CI)

검사 규칙은 이 저장소에 하나만 둔다. 콘텐츠 저장소의 CI는 이 저장소를 내려받아 검사기를 실행한다. 스프링과 DB 없이 돈다.

```bash
gradle -p retrievo/backend checkContent -PcontentDir=$PWD/content/questions
```

- 파일마다의 규칙(위 표)에 더해 파일 사이 충돌도 본다: 같은 레슨 키가 두 파일에 있음, 같은 주제 키에 이름이 다름
- 오류가 있으면 실패한다. 경고(지연 확인용 판정 문제 부족, 출처 없음 등)는 알려주기만 한다
- 앱도 시작할 때 같은 검사를 먼저 하고, 오류가 있으면 아무것도 가져오지 않는다

## 가져오기 규칙

- 같은 파일을 다시 가져와도 결과가 같다 (키로 기존 행을 찾는다)
- 문제 내용(질문, 코드, 보기, 정답, 해설, 체크리스트, 출처, 난이도, 형태)이 바뀌면 새 버전을 만든다. 이전 버전과 그 풀이 기록은 남는다
- 검수 상태나 순서만 바뀌면 새 버전을 만들지 않는다
- 파일에서 빠진 문제는 지우지 않고 숨긴다
- 오류가 하나라도 있으면 그 파일은 아무것도 가져오지 않고, 오류를 모두 알려준다. 모르는 항목(오타)도 오류다
