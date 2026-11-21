/*
 * 백엔드 API 응답·요청 형식. backend의 record와 같게 둔다.
 * - QuestionView: content/QuestionView.java
 * - TodayCheck, ConceptStatus: learning/DelayedCheckController
 * - LessonSummary, LessonDetail: content/LessonQueryService
 * - Report: learning/ReportController.Report
 * - Home: learning/HomeController.Home. bestStage·record·retrievals와 함께 쌓이기만 하는 성장 값이다. 뜻은 lib/memory.ts (ADR-025)
 * - Me: auth/MeController.Me
 * - SubmitRequest / SubmissionResult: learning/SubmitRequest.java, learning/SubmissionResult.java
 */

export type QuestionType = "MULTIPLE_CHOICE" | "OX" | "CODE_PREDICT" | "LINE_PICK" | "DESCRIPTIVE";

export type Confidence = "SURE" | "UNSURE" | "UNKNOWN";

/** LESSON: 레슨. DELAYED_CHECK: 오늘 예정된 지연 확인. PRACTICE: 연습(지연 확인 오답 뒤 다시 배우기). 일정은 바뀌지 않는다 */
export type SubmissionMode = "LESSON" | "DELAYED_CHECK" | "PRACTICE";

/** 답을 내기 전에 보여주는 문제. 정답과 해설은 담지 않는다 (답 먼저) */
export interface QuestionView {
  questionVersionId: number;
  conceptId: number;
  type: QuestionType;
  body: string;
  code: string | null;
  choices: string[] | null;
}

/** 오늘 확인할 개념과, 개념마다 처음과 다른 문제 하나 */
export interface TodayCheck {
  conceptId: number;
  conceptName: string;
  /** 이번 확인 전까지 통과한 확인 수(1~3). 1 = 3일, 2 = 7일, 3 = 21일 확인. 4가 되면 졸업 */
  attemptNo: number;
  dueDate: string;
  /** 배운 날 기준(같은 날 판정 문제 모두 정답)을 통과한 날 */
  learnedOn: string | null;
  /** 지난 확인에서 확실했는데 틀려서 다음 날 다시 묻는 개념. 목록 맨 앞에 온다 */
  sureWrong: boolean;
  question: QuestionView;
  /** 마지막(21일) 확인일 때만. 판정 문제를 맞혀 졸업한 뒤 동료에게 가르치듯 말해 볼 질문 (자기 채점, 판정에 쓰지 않음) */
  teach: TeachPrompt | null;
}

export interface TeachPrompt {
  questionVersionId: number;
  body: string;
  /** 말했는지 바로 판단할 수 있는 항목 */
  checklist: string[];
}

/** 풀어 본 개념의 진행 상태 */
export interface ConceptStatus {
  conceptId: number;
  conceptName: string;
  lessonId: number;
  lessonTitle: string;
  /** 통과한 확인 수. 0 = 배우는 중, 4 = 졸업 */
  stage: number;
  graduated: boolean;
  learnedOn: string | null;
  dueDate: string | null;
  sureWrong: boolean;
  graduatedAt: string | null;
  /** 지금까지 도달한 가장 높은 단계(0~4). 틀려서 stage가 내려가도 이 값은 줄지 않는다 */
  bestStage: number;
}

export interface LessonSummary {
  id: number;
  /** dev-lessons의 레슨 slug. 레슨 본문 주소에 쓴다 */
  key: string;
  unit: string;
  title: string;
  questionCount: number;
}

/** 레슨 하나. 본문은 레슨 사이트(dev-lessons)에 있고 앱은 그 페이지를 안에 띄운다. 서버가 주는 steps는 쓰지 않는다 */
export type LessonDetail = LessonSummary;

/** "나" 화면의 프로필. joinedOn은 가입한 서비스 날짜, days는 가입한 날을 1일째로 센 오늘 */
export interface Me {
  id: number;
  nickname: string;
  joinedOn: string;
  days: number;
}

/** 맞힌 수와 전체 수. 비율은 화면이 계산한다 (표본이 적은지 함께 보여주려고) */
export interface Rate {
  correct: number;
  total: number;
}

/** 기록 화면. 모두 실제 풀이·확인 기록에서 센 값이다 */
export interface Report {
  today: string;
  /** 배운 날(레슨에서 낸 답)과 3·7·21일 재확인의 정답률 */
  curve: { learnedDay: Rate; day3: Rate; day7: Rate; day21: Rate };
  /** 개념의 단계별 수 */
  stages: { learning: number; passed1: number; passed2: number; passed3: number; graduated: number };
  /** 지금까지 낸 답 수 */
  retrievals: number;
  /** 확실 → 애매 → 모름 순서 */
  confidence: ({ confidence: Confidence } & Rate)[];
  /** 지난 확인에서 확실했는데 틀린 개념 수 */
  sureWrong: number;
  /** 최근 26주 동안 답을 낸 날과 그날 낸 답 수. 답이 없는 날은 빠진다 */
  activity: { date: string; count: number }[];
}

/** 오늘 화면. 오늘 확인의 진행과, 쌓이기만 하는 값들 */
export interface Home {
  today: string;
  /** 오늘 끝낸 확인 수 */
  checksDone: number;
  /** 오늘 확인 전체: 끝낸 것과 남은 것 */
  checksTotal: number;
  /** 답을 낸 날이 이어진 일수. 오늘 아직 답을 내지 않았으면 어제까지 센 값 */
  streak: number;
  /** 이번 주(월~일) 가운데 답을 낸 날 */
  activeDates: string[];
  /** 배움을 마친 개념 수 (bestStage 1 이상) */
  learned: number;
  /** 21일 뒤에도 기억한 개념 수 */
  longTerm: number;
  /** 지금까지 낸 답 수 */
  retrievals: number;
}

export interface SubmitRequest {
  /** 화면이 문제마다 만드는 UUID. 같은 값으로 다시 보내면 처음 결과를 돌려받는다 */
  clientSubmissionId: string;
  questionVersionId: number;
  /** 객관식·코드 예측: 보기 번호(1부터). OX: O 또는 X. 줄 고르기: "4" 또는 "7,8" */
  selected: string;
  confidence: Confidence;
  mode: SubmissionMode;
}

/** 답을 낸 뒤에야 받는 결과. 정답과 해설은 여기서 처음 보인다 */
export interface SubmissionResult {
  submissionId: number;
  correct: boolean;
  selected: string;
  answer: string;
  confidence: Confidence;
  explanation: string;
  sourceUrl: string | null;
  delayedCheck: boolean;
  /** 이 답으로 기억 기록(bestStage)이 늘었으면 전과 후. 늘지 않았으면 null */
  record: { before: number; after: number } | null;
  /** 지금까지 낸 답 수. 이 답을 포함한다 */
  retrievals: number;
}

export interface RetrievoApi {
  todayChecks(): Promise<TodayCheck[]>;
  lessons(): Promise<LessonSummary[]>;
  lesson(lessonId: number): Promise<LessonDetail>;
  /** 레슨의 판정 문제. 정답과 해설은 담지 않는다 */
  lessonQuestions(lessonId: number): Promise<QuestionView[]>;
  /** 풀어 본 개념의 진행 상태 */
  concepts(): Promise<ConceptStatus[]>;
  /** 연습할 문제 하나. 배운 개념만. 아직 안 푼 문제나 가장 오래전에 푼 문제라 방금 틀린 문제와 다르다 (ADR-021) */
  practiceQuestion(conceptId: number): Promise<QuestionView>;
  report(): Promise<Report>;
  /** 오늘 화면의 진행과 쌓인 값 */
  home(): Promise<Home>;
  me(): Promise<Me>;
  logout(): Promise<void>;
  submit(request: SubmitRequest): Promise<SubmissionResult>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
