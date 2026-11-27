import type { ConceptStatus, LessonSummary } from "./api/types";
import { daysBetween } from "./schedule";
import { TOTAL_CHECKS } from "./stages";

/*
 * 레슨 화면의 진행 상태 (ADR-017).
 * 진행 상태는 개념 단위로 쌓인다. 레슨에는 개념이 여러 개일 수 있어서, 가장 늦은 개념을 레슨의 상태로 본다.
 */

export type LessonState = "graduated" | "managed" | "new";

export interface LessonProgress {
  lesson: LessonSummary;
  state: LessonState;
  /** 통과한 확인 수. 개념이 여럿이면 가장 적은 값 */
  passed: number;
  /** 다음 확인일. 개념이 여럿이면 가장 가까운 날 */
  dueDate: string | null;
  /** 이 레슨의 기억 기록: 개념들이 도달한 가장 높은 단계 가운데 가장 낮은 값(0~4). 줄지 않는다 */
  best: number;
}

export function lessonProgress(lessons: LessonSummary[], concepts: ConceptStatus[]): LessonProgress[] {
  const byLesson = new Map<number, ConceptStatus[]>();
  for (const c of concepts) {
    byLesson.set(c.lessonId, [...(byLesson.get(c.lessonId) ?? []), c]);
  }

  return lessons.map((lesson) => {
    const cs = byLesson.get(lesson.id) ?? [];
    if (cs.length === 0) {
      return { lesson, state: "new", passed: 0, dueDate: null, best: 0 };
    }
    const best = Math.min(...cs.map((c) => c.bestStage));
    const open = cs.filter((c) => !c.graduated);
    if (open.length === 0) {
      return { lesson, state: "graduated", passed: TOTAL_CHECKS, dueDate: null, best };
    }
    const dues = open.map((c) => c.dueDate).filter((d): d is string => d !== null);
    return {
      lesson,
      state: "managed",
      passed: Math.min(...open.map((c) => c.stage)),
      dueDate: dues.length ? dues.reduce((a, b) => (a < b ? a : b)) : null,
      best,
    };
  });
}

/** 레슨 사이트(dev-lessons) 주소. 로컬에서 사이트를 띄워 확인할 때만 NEXT_PUBLIC_LESSON_SITE로 바꾼다 */
const LESSON_SITE = process.env.NEXT_PUBLIC_LESSON_SITE || "https://wanja727.github.io/dev-lessons";

/** 레슨 사이트의 출처(origin). 레슨 본문이 보낸 메시지가 맞는지 확인할 때 쓴다 */
export function lessonSiteOrigin(): string {
  return new URL(LESSON_SITE).origin;
}

/**
 * 레슨 본문 페이지. 본문은 dev-lessons 사이트에 있고 앱은 그 페이지를 iframe으로 띄운다.
 * embed를 주면 앱 안 화면용 주소다 (사이트 이동 링크를 숨기고 바깥 링크는 새 탭으로 연다).
 */
export function lessonPageUrl(key: string, embed = false, at?: LessonSection): string {
  return `${LESSON_SITE}/lessons/${encodeURIComponent(key)}/${embed ? "?embed=1" : ""}${at ? `#${at}` : ""}`;
}

/** 레슨 본문의 구역: 질문(q1~q9)이나 실무에서는(practice). 레슨 페이지의 #앵커와 같다 */
export type LessonSection = `q${number}` | "practice";
export function asLessonSection(v: unknown): LessonSection | undefined {
  return typeof v === "string" && /^(q[1-9]|practice)$/.test(v) ? (v as LessonSection) : undefined;
}

/** 찾아보기 페이지. 용어 카드도 레슨 사이트에 있고 앱은 iframe으로 띄운다 */
export function termsPageUrl(): string {
  return `${LESSON_SITE}/terms/?embed=1`;
}

/**
 * 찾아보기에서 고른 레슨을 앱의 레슨 화면 주소로 바꾼다. 앱에 없는 레슨이면 null이다 (그때는 사이트에서 연다).
 * 구역(at)은 주소에 남겨 레슨 화면이 그 자리로 스크롤하게 한다.
 */
export function appLessonHref(lessons: LessonSummary[], key: string, at?: LessonSection): string | null {
  const lesson = lessons.find((l) => l.key === key);
  if (!lesson) return null;
  return `/lessons/${lesson.id}${at ? `?at=${at}` : ""}`;
}

/** 관리 중인 레슨을 다음 확인이 가까운 순으로. 배우는 중(확인일 없음)은 맨 앞 */
export function byNextCheck(a: LessonProgress, b: LessonProgress): number {
  if (a.dueDate === b.dueDate) return a.lesson.id - b.lesson.id;
  if (a.dueDate === null) return -1;
  if (b.dueDate === null) return 1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

/** 관리 중인 레슨 한 줄 설명: 언제 다시 묻는지 */
export function nextCheckLabel(p: LessonProgress, today: string): string {
  if (p.passed === 0 || p.dueDate === null) return "같은 날 모두 맞히면 학습 완료";
  const days = daysBetween(today, p.dueDate);
  const when = days <= 0 ? "오늘 확인" : `${days}일 뒤 확인`;
  return when;
}

/** 오늘 확인할 레슨인가. 화면에서 이 줄만 진하게 보인다 */
export function isDueToday(p: LessonProgress, today: string): boolean {
  return p.state === "managed" && p.dueDate !== null && p.dueDate <= today;
}
