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
  sureWrong: boolean;
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
      return { lesson, state: "new", passed: 0, dueDate: null, sureWrong: false, best: 0 };
    }
    const best = Math.min(...cs.map((c) => c.bestStage));
    const open = cs.filter((c) => !c.graduated);
    if (open.length === 0) {
      return { lesson, state: "graduated", passed: TOTAL_CHECKS, dueDate: null, sureWrong: false, best };
    }
    const dues = open.map((c) => c.dueDate).filter((d): d is string => d !== null);
    return {
      lesson,
      state: "managed",
      passed: Math.min(...open.map((c) => c.stage)),
      dueDate: dues.length ? dues.reduce((a, b) => (a < b ? a : b)) : null,
      sureWrong: open.some((c) => c.sureWrong),
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
export function lessonPageUrl(key: string, embed = false): string {
  return `${LESSON_SITE}/lessons/${encodeURIComponent(key)}/${embed ? "?embed=1" : ""}`;
}

/** 관리 중인 레슨을 다음 확인이 가까운 순으로. 배우는 중(확인일 없음)은 맨 앞 */
export function byNextCheck(a: LessonProgress, b: LessonProgress): number {
  if (a.dueDate === b.dueDate) return a.lesson.id - b.lesson.id;
  if (a.dueDate === null) return -1;
  if (b.dueDate === null) return 1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

/** 관리 중인 레슨 한 줄 설명: 언제 다시 묻는지와 그 이유 */
export function nextCheckLabel(p: LessonProgress, today: string): string {
  if (p.passed === 0 || p.dueDate === null) return "같은 날 모두 맞히면 학습 완료";
  const days = daysBetween(today, p.dueDate);
  const when = days <= 0 ? "오늘 확인" : `${days}일 뒤 확인`;
  if (p.sureWrong) return `${when}, 틀렸던 개념`;
  return when;
}

/** 오늘 확인할 레슨인가. 화면에서 이 줄만 진하게 보인다 */
export function isDueToday(p: LessonProgress, today: string): boolean {
  return p.state === "managed" && p.dueDate !== null && p.dueDate <= today;
}
