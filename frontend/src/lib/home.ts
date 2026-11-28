import type { ConceptStatus, Rate } from "./api/types";
import type { LessonProgress } from "./lessonProgress";
import { weekDates } from "./memory";

/*
 * 오늘 화면의 계산 (2026-11-28 다시 설계).
 * 위에서 아래로 시간 범위가 넓어진다: 오늘 할 일 → 연속 학습 → 이번 주 → 최근 기억률 → 전체 로드맵 → 과정별 진행도.
 * 숫자는 모두 실제 기록에서 센 값이고, 표본이 모자라면 숫자 대신 안내를 보여 준다.
 */

/** 시각(0~23시)에 맞는 인사. 하루는 새벽 4시에 바뀐다고 보고 그 전은 밤으로 친다 */
export function timeGreeting(hour: number): string {
  if (hour < 4) return "늦은 시간까지 대단해요";
  if (hour < 11) return "좋은 아침이에요";
  if (hour < 14) return "점심은 드셨나요";
  if (hour < 18) return "좋은 오후예요";
  if (hour < 22) return "좋은 저녁이에요";
  return "오늘 하루 수고했어요";
}

export interface GreetingInput {
  hour: number;
  /** 오늘 할 일(복습과 새 레슨)을 다 했는가 */
  allDone: boolean;
  /** 배운 개념이 하나도 없는 첫날인가 */
  firstDay: boolean;
  streak: number;
}

/**
 * 맨 위 인사. 상황이 있으면 상황을, 없으면 시각을 말한다.
 * 다 마친 날 → 처음 온 날 → 연속 학습이 일주일을 넘긴 날 → 시각 순으로 고른다.
 */
export function greeting({ hour, allDone, firstDay, streak }: GreetingInput): string {
  if (firstDay) return "반가워요";
  if (allDone) return "오늘 할 일을 다 했어요";
  if (streak >= 7) return `${streak}일째 이어 가고 있어요`;
  return timeGreeting(hour);
}

/** 인사 뒤에 이름을 붙인다. 이름을 아직 모르면 인사만 */
export function withName(text: string, nickname: string | null): string {
  return nickname ? `${text}, ${nickname}님` : text;
}

/** 오늘(서비스 날짜) 배움을 마친 레슨 수. 레슨의 개념이 모두 오늘까지 배움을 마쳤고 그중 하나가 오늘이면 센다 */
export function lessonsLearnedOn(concepts: ConceptStatus[], dates: Set<string>): number {
  const byLesson = new Map<number, ConceptStatus[]>();
  for (const c of concepts) {
    byLesson.set(c.lessonId, [...(byLesson.get(c.lessonId) ?? []), c]);
  }
  let count = 0;
  for (const cs of byLesson.values()) {
    if (cs.some((c) => c.learnedOn === null)) continue;
    const last = cs.map((c) => c.learnedOn as string).reduce((a, b) => (a > b ? a : b));
    if (dates.has(last)) count += 1;
  }
  return count;
}

export interface WeekDay {
  date: string;
  count: number;
  /** 이번 주에서 가장 많이 푼 날을 1로 본 높이(0~1) */
  ratio: number;
  isToday: boolean;
  future: boolean;
}

/** 이번 주 월~일의 푼 문제 수. 답이 없는 날은 0으로 채운다 */
export function weekBars(today: string, solved: { date: string; count: number }[]): WeekDay[] {
  const byDate = new Map(solved.map((d) => [d.date, d.count]));
  const days = weekDates(today).map((date) => ({ date, count: byDate.get(date) ?? 0 }));
  const max = Math.max(1, ...days.map((d) => d.count));
  return days.map((d) => ({ ...d, ratio: d.count / max, isToday: d.date === today, future: d.date > today }));
}

/** 기억률을 숫자로 보여 줄 만큼 다시 물은 횟수. 이보다 적으면 한두 번의 결과에 크게 흔들린다 */
export const RECALL_MIN_SAMPLES = 5;

/** 최근 기억률(%). 표본이 모자라면 null */
export function recallPercent(rate: Rate): number | null {
  if (rate.total < RECALL_MIN_SAMPLES) return null;
  return Math.round((rate.correct / rate.total) * 100);
}

export interface Roadmap {
  total: number;
  /** 배움을 마친 레슨 (장기 기억 포함) */
  learned: number;
  longTerm: number;
}

export function roadmap(lessons: LessonProgress[]): Roadmap {
  return {
    total: lessons.length,
    learned: lessons.filter((p) => p.best >= 1).length,
    longTerm: lessons.filter((p) => p.best >= 4).length,
  };
}

export interface UnitProgress extends Roadmap {
  unit: string;
}

/** 과정(단원)별 진행. 레슨이 놓인 순서대로 과정을 늘어놓는다 */
export function unitProgress(lessons: LessonProgress[]): UnitProgress[] {
  const groups = new Map<string, LessonProgress[]>();
  for (const p of lessons) {
    groups.set(p.lesson.unit, [...(groups.get(p.lesson.unit) ?? []), p]);
  }
  return [...groups.entries()].map(([unit, ps]) => ({ unit, ...roadmap(ps) }));
}
