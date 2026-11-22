import { isCorrect } from "../grading";
import { weekDates } from "../memory";
import { serviceDate } from "../schedule";
import type {
  ConceptStatus,
  Home,
  LessonSummary,
  QuestionView,
  RetrievoApi,
  SubmissionResult,
  TeachPrompt,
  TodayCheck,
} from "./types";

/*
 * 백엔드 없이 화면을 개발하는 목 API. 응답 형식은 실제 API와 같다.
 * 문제 내용은 예시다. 실제 문제 원본은 dev-lessons의 YAML 파일이다.
 */

interface MockQuestion extends QuestionView {
  lessonId: number;
  answer: string;
  explanation: string;
  sourceUrl: string | null;
}

const HIBERNATE_FETCHING = "https://docs.jboss.org/hibernate/orm/6.6/userguide/html_single/Hibernate_User_Guide.html#fetching";

const questions: MockQuestion[] = [
  {
    questionVersionId: 101,
    lessonId: 1,
    conceptId: 11,
    type: "MULTIPLE_CHOICE",
    body: "아래 코드를 실행하면 SELECT는 모두 몇 번 실행될까요?",
    code: [
      "// 팀 10개, 각 팀의 members는 LAZY",
      "List<Team> teams = teamRepository.findAll();",
      "for (Team t : teams) {",
      "    t.getMembers().size();",
      "}",
    ].join("\n"),
    choices: ["1번", "2번", "10번", "11번"],
    answer: "4",
    explanation:
      "팀 목록을 가져오는 SELECT 1번에, 팀마다 members를 읽는 SELECT가 10번 더 나가요. 목록 1번에 항목마다 N번, 그래서 N+1이에요.",
    sourceUrl: HIBERNATE_FETCHING,
  },
  {
    questionVersionId: 104,
    lessonId: 1,
    conceptId: 11,
    type: "OX",
    body: "연관관계를 EAGER로 바꾸면 findAll()에서 생기는 N+1이 사라진다.",
    code: null,
    choices: null,
    answer: "X",
    explanation:
      "JPQL로 목록을 가져온 뒤 EAGER 연관관계를 채우려고 항목마다 SELECT가 다시 나가요. 쿼리 시점만 앞당겨질 뿐 N+1은 그대로예요.",
    sourceUrl: HIBERNATE_FETCHING,
  },
  {
    questionVersionId: 105,
    lessonId: 1,
    conceptId: 11,
    type: "CODE_PREDICT",
    body: "fetch join으로 바꾼 아래 코드에서 SELECT는 몇 번 나갈까요?",
    code: [
      '@Query("select t from Team t join fetch t.members")',
      "List<Team> findAllWithMembers();",
      "",
      "teamRepository.findAllWithMembers()",
      "    .forEach(t -> t.getMembers().size());",
    ].join("\n"),
    choices: ["1번", "2번", "11번"],
    answer: "1",
    explanation: "fetch join은 팀과 members를 한 번의 SELECT로 함께 가져와요. 루프에서 members를 읽어도 추가 쿼리가 없어요.",
    sourceUrl: HIBERNATE_FETCHING,
  },
  {
    questionVersionId: 102,
    lessonId: 2,
    conceptId: 12,
    type: "LINE_PICK",
    body: "트랜잭션 없이 실행되는 호출이 있는 줄을 고르세요.",
    code: [
      "@Service",
      "class CouponService {",
      "  void issueAll(List<User> users) {",
      "    users.forEach(this::issue);",
      "  }",
      "  @Transactional",
      "  void issue(User u) { /* 발급 */ }",
      "}",
    ].join("\n"),
    choices: null,
    answer: "4",
    explanation:
      "this::issue는 같은 클래스 안의 호출이라 프록시를 거치지 않아요. 그래서 issue()의 @Transactional이 적용되지 않아요.",
    sourceUrl: "https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html",
  },
  {
    questionVersionId: 103,
    lessonId: 3,
    conceptId: 13,
    type: "OX",
    body: "SQL 표준의 REPEATABLE READ 격리 수준은 팬텀 리드를 막는다.",
    code: null,
    choices: null,
    answer: "X",
    explanation:
      "SQL 표준에서 REPEATABLE READ는 팬텀 리드를 허용하고, SERIALIZABLE만 막아요. MySQL InnoDB와 PostgreSQL은 구현 방식 덕분에 REPEATABLE READ에서도 대부분 막아 주지만, 표준이 보장하는 것은 아니에요.",
    sourceUrl: "https://www.postgresql.org/docs/current/transaction-iso.html",
  },
  {
    questionVersionId: 106,
    lessonId: 5,
    conceptId: 15,
    type: "MULTIPLE_CHOICE",
    body: "같은 결제 요청이 두 번 들어와도 한 번만 처리되게 하려면 무엇을 기준으로 막아야 할까요?",
    code: null,
    choices: ["요청이 들어온 시각", "클라이언트가 만든 멱등 키", "사용자 id", "결제 금액"],
    answer: "2",
    explanation:
      "클라이언트가 요청마다 만든 멱등 키를 유니크 제약으로 저장하면, 같은 키로 다시 온 요청은 처음 결과를 돌려주고 다시 처리하지 않아요.",
    sourceUrl: null,
  },
];

const lessons: LessonSummary[] = [
  { id: 1, key: "jpa-n-plus-1", unit: "JPA", title: "N+1 문제", questionCount: 3 },
  { id: 2, key: "transactional-proxy", unit: "Spring", title: "@Transactional 자기 호출", questionCount: 1 },
  { id: 3, key: "isolation-level", unit: "DB", title: "격리 수준과 팬텀 리드", questionCount: 1 },
  { id: 4, key: "jpa-persistence-context", unit: "JPA", title: "영속성 컨텍스트", questionCount: 0 },
  { id: 5, key: "idempotency", unit: "설계", title: "멱등성", questionCount: 1 },
  { id: 6, key: "db-index", unit: "DB", title: "인덱스와 실행 계획", questionCount: 0 },
  { id: 7, key: "spring-di", unit: "Spring", title: "의존성 주입과 빈 생명주기", questionCount: 0 },
  { id: 8, key: "http-cache", unit: "네트워크", title: "HTTP 캐시", questionCount: 0 },
  { id: 9, key: "java-gc", unit: "Java", title: "GC와 메모리 영역", questionCount: 0 },
  { id: 10, key: "optimistic-lock", unit: "JPA", title: "낙관적 락", questionCount: 0 },
  { id: 11, key: "deadlock", unit: "DB", title: "교착 상태", questionCount: 0 },
  { id: 12, key: "tcp-handshake", unit: "네트워크", title: "TCP 연결", questionCount: 0 },
  { id: 13, key: "java-concurrency", unit: "Java", title: "동시성과 synchronized", questionCount: 0 },
  { id: 14, key: "redis-cache", unit: "설계", title: "캐시 전략", questionCount: 0 },
];

const conceptNames: Record<number, string> = {
  11: "JPA · N+1 문제",
  12: "Spring · @Transactional 자기 호출",
  13: "DB · 격리 수준과 팬텀 리드",
  14: "JPA · 영속성 컨텍스트",
  15: "설계 · 멱등성",
  16: "DB · 인덱스와 실행 계획",
  17: "Spring · 의존성 주입과 빈 생명주기",
  18: "네트워크 · HTTP 캐시",
  19: "Java · GC와 메모리 영역",
  20: "JPA · 낙관적 락",
  21: "DB · 교착 상태",
  22: "네트워크 · TCP 연결",
};

const conceptLesson: Record<number, number> = {
  11: 1,
  12: 2,
  13: 3,
  14: 4,
  15: 5,
  16: 6,
  17: 7,
  18: 8,
  19: 9,
  20: 10,
  21: 11,
  22: 12,
};

/**
 * 개념마다 통과한 확인 수(0 = 배우는 중, 4 = 졸업), 지금까지 가장 높았던 단계, 배운 지 며칠, 다음 확인까지 며칠.
 * 15(멱등성)는 아직 풀지 않은 개념이라 없다
 */
const progress: Record<
  number,
  { stage: number; best: number; learnedDaysAgo: number; dueInDays: number }
> = {
  12: { stage: 1, best: 2, learnedDaysAgo: 8, dueInDays: 0 },
  11: { stage: 1, best: 1, learnedDaysAgo: 3, dueInDays: 0 },
  13: { stage: 3, best: 3, learnedDaysAgo: 21, dueInDays: 0 },
  14: { stage: 4, best: 4, learnedDaysAgo: 30, dueInDays: 0 },
  16: { stage: 4, best: 4, learnedDaysAgo: 40, dueInDays: 0 },
  17: { stage: 4, best: 4, learnedDaysAgo: 36, dueInDays: 0 },
  18: { stage: 3, best: 3, learnedDaysAgo: 12, dueInDays: 9 },
  19: { stage: 3, best: 3, learnedDaysAgo: 10, dueInDays: 11 },
  20: { stage: 2, best: 2, learnedDaysAgo: 5, dueInDays: 2 },
  21: { stage: 2, best: 3, learnedDaysAgo: 15, dueInDays: 1 },
  22: { stage: 1, best: 1, learnedDaysAgo: 1, dueInDays: 2 },
};

/** 마지막 확인에서 가르치듯 말해 볼 질문. 실제로는 개념의 서술형(연습) 문제에서 고른다 */
const teachPrompts: Record<number, TeachPrompt> = {
  13: {
    questionVersionId: 901,
    body: "트랜잭션 격리 수준 네 가지와 각각 막는 현상을 설명해 보세요.",
    checklist: [
      "네 단계를 말했다",
      "더티 리드, 반복 불가능 읽기, 팬텀 리드를 구분했다",
      "MVCC나 스냅샷을 말했다",
      "높일수록 대기와 재시도가 늘어난다고 말했다",
    ],
  },
};

/** 지연 확인 결과로 단계를 옮긴다 (백엔드 ReviewSchedule과 같은 규칙: 맞히면 +1, 4면 졸업, 틀리면 -1(1 아래로는 안 감)) */
function recordCheck(conceptId: number, correct: boolean) {
  const p = progress[conceptId];
  if (!p || p.stage < 1 || p.stage > 3) return;
  const gaps = [0, 4, 14, 0];
  if (correct) {
    p.stage += 1;
    p.best = Math.max(p.best, p.stage);
    p.dueInDays = gaps[p.stage - 1] ?? 0;
  } else {
    p.stage = Math.max(1, p.stage - 1);
    p.dueInDays = p.stage === 1 ? 3 : 4;
  }
}

/** 오늘 레슨에서 맞힌 문제. 개념의 레슨 문제를 모두 맞히면 배운 날 기준을 통과한다 (백엔드와 같은 규칙, ADR-021) */
const lessonCorrectToday: Record<number, Set<number>> = {};

/** 오늘 낸 답 수, 오늘 끝낸 확인 수, 지금까지 낸 답 수 (예시 값에서 시작한다) */
let answersToday = 0;
let checksDoneToday = 0;
let retrievals = 1284;

/** 어제까지 이어진 연속 학습 일수 (예시 값) */
const STREAK_UNTIL_YESTERDAY = 12;

const stageCount = (stage: number) => Object.values(progress).filter((p) => p.stage === stage).length;

/** 연습에 낸 문제 순서. 가장 오래전에 낸 문제를 먼저 낸다 (백엔드와 같은 규칙) */
const lastSeen = new Map<number, number>();
let seenClock = 0;

/** 같은 clientSubmissionId로 다시 보내면 처음 결과를 돌려준다 (백엔드와 같은 규칙) */
const submitted = new Map<string, SubmissionResult>();
let nextSubmissionId = 1;

function view(q: MockQuestion): QuestionView {
  const { conceptId, questionVersionId, type, body, code, choices } = q;
  return { conceptId, questionVersionId, type, body, code, choices };
}

const daysFromToday = (days: number) => serviceDate(days);

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 150));
}

/** 처음 푼 개념은 배우는 중(0단계)으로 만들고, 레슨 문제를 오늘 모두 맞히면 1단계로 올려 3일 뒤 확인을 잡는다 */
function recordLessonAnswer(q: MockQuestion, correct: boolean) {
  const { conceptId } = q;
  progress[conceptId] ??= { stage: 0, best: 0, learnedDaysAgo: 0, dueInDays: 0 };
  if (!correct || progress[conceptId].stage > 0) return;
  const solved = (lessonCorrectToday[conceptId] ??= new Set());
  solved.add(q.questionVersionId);
  const all = questions.filter((it) => it.conceptId === conceptId && it.lessonId === q.lessonId);
  if (all.every((it) => solved.has(it.questionVersionId))) {
    progress[conceptId] = { stage: 1, best: 1, learnedDaysAgo: 0, dueInDays: 3 };
  }
}

export const mockApi: RetrievoApi = {
  todayChecks: () => {
    const due = Object.entries(progress)
      .map(([id, p]) => ({ conceptId: Number(id), ...p }))
      .filter((p) => p.stage >= 1 && p.stage < 4 && p.dueInDays <= 0);
    return delay<TodayCheck[]>(
      due.flatMap((p) => {
        const q = questions.find((it) => it.conceptId === p.conceptId);
        if (!q) return [];
        return [
          {
            conceptId: p.conceptId,
            conceptName: conceptNames[p.conceptId],
            attemptNo: p.stage,
            dueDate: daysFromToday(0),
            learnedOn: daysFromToday(-p.learnedDaysAgo),
            question: view(q),
            teach: p.stage === 3 ? (teachPrompts[p.conceptId] ?? null) : null,
          },
        ];
      }),
    );
  },

  lessons: () => delay(lessons),

  lesson: async (lessonId) => {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (!lesson) throw new Error("없는 레슨이다");
    return delay(lesson);
  },

  lessonQuestions: async (lessonId) => {
    if (!lessons.some((l) => l.id === lessonId)) throw new Error("없는 레슨이다");
    return delay(questions.filter((q) => q.lessonId === lessonId).map(view));
  },

  concepts: () =>
    delay<ConceptStatus[]>(
      Object.entries(progress).map(([id, p]) => {
        const conceptId = Number(id);
        const lesson = lessons.find((l) => l.id === conceptLesson[conceptId]);
        const graduated = p.stage >= 4;
        return {
          conceptId,
          conceptName: conceptNames[conceptId],
          lessonId: lesson?.id ?? 0,
          lessonTitle: lesson?.title ?? "",
          stage: p.stage,
          graduated,
          learnedOn: p.stage > 0 ? daysFromToday(-p.learnedDaysAgo) : null,
          dueDate: graduated || p.stage === 0 ? null : daysFromToday(p.dueInDays),
          graduatedAt: graduated ? daysFromToday(-9) : null,
          bestStage: p.best,
        };
      }),
    ),

  practiceQuestion: async (conceptId) => {
    if ((progress[conceptId]?.stage ?? 0) < 1) throw new Error("연습할 수 있는 개념이 아니다");
    const candidates = questions.filter((it) => it.conceptId === conceptId);
    const q = [...candidates].sort(
      (a, b) => (lastSeen.get(a.questionVersionId) ?? -1) - (lastSeen.get(b.questionVersionId) ?? -1),
    )[0];
    if (!q) throw new Error("연습할 문제가 없다");
    return delay(view(q));
  },

  logout: () => delay(undefined),

  me: () => delay({ id: 1, nickname: "me", joinedOn: daysFromToday(-30), days: 31 }),

  home: () => {
    const today = daysFromToday(0);
    const all = Object.values(progress);
    const due = all.filter((p) => p.stage >= 1 && p.stage < 4 && p.dueInDays <= 0).length;
    return delay<Home>({
      today,
      checksDone: checksDoneToday,
      checksTotal: checksDoneToday + due,
      streak: STREAK_UNTIL_YESTERDAY + (answersToday > 0 ? 1 : 0),
      activeDates: weekDates(today).filter((d) => d < today || (d === today && answersToday > 0)),
      learned: all.filter((p) => p.best >= 1).length,
      longTerm: all.filter((p) => p.best >= 4).length,
      retrievals,
    });
  },

  report: () => {
    // 예시 기록. 실제 값은 백엔드가 풀이·확인 기록에서 센다
    const activity: { date: string; count: number }[] = [];
    for (let i = 0; i < 26 * 7; i++) {
      const pattern = (i * 7 + 3) % 11;
      if (i < 40 ? pattern < 7 : pattern < 4) activity.push({ date: daysFromToday(-i), count: 1 + ((i * 5) % 12) });
    }
    return delay({
      today: daysFromToday(0),
      curve: {
        learnedDay: { correct: 118, total: 137 },
        day3: { correct: 31, total: 43 },
        day7: { correct: 22, total: 36 },
        day21: { correct: 13, total: 24 },
      },
      stages: {
        learning: stageCount(0),
        passed1: stageCount(1),
        passed2: stageCount(2),
        passed3: stageCount(3),
        graduated: stageCount(4),
      },
      retrievals,
      activity: activity.reverse(),
    });
  },

  submit: async (request) => {
    const existing = submitted.get(request.clientSubmissionId);
    if (existing) return delay(existing);

    const q = questions.find((it) => it.questionVersionId === request.questionVersionId);
    if (!q) throw new Error("없는 문제다");

    const correct = isCorrect(q.type, request.selected, q.answer);
    lastSeen.set(q.questionVersionId, seenClock++);
    answersToday += 1;
    retrievals += 1;
    if (request.mode === "DELAYED_CHECK") checksDoneToday += 1;
    const before = progress[q.conceptId]?.best ?? 0;
    if (request.mode === "LESSON") recordLessonAnswer(q, correct);
    else if (request.mode === "DELAYED_CHECK") recordCheck(q.conceptId, correct);
    // PRACTICE는 기록만 하고 일정을 바꾸지 않는다

    const result: SubmissionResult = {
      submissionId: nextSubmissionId++,
      correct,
      selected: request.selected,
      answer: q.answer,
      explanation: q.explanation,
      sourceUrl: q.sourceUrl,
      delayedCheck: request.mode === "DELAYED_CHECK",
      record: (progress[q.conceptId]?.best ?? 0) > before ? { before, after: progress[q.conceptId].best } : null,
      retrievals,
    };
    submitted.set(request.clientSubmissionId, result);
    return delay(result);
  },
};
