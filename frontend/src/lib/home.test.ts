import { describe, expect, it } from "vitest";
import type { ConceptStatus } from "./api/types";
import { greeting, lessonsLearnedOn, recallPercent, roadmap, timeGreeting, unitProgress, weekBars, withName } from "./home";
import type { LessonProgress } from "./lessonProgress";

const concept = (lessonId: number, learnedOn: string | null, conceptId = lessonId): ConceptStatus => ({
  conceptId,
  conceptName: "",
  lessonId,
  lessonTitle: "",
  stage: learnedOn ? 1 : 0,
  graduated: false,
  learnedOn,
  dueDate: null,
  graduatedAt: null,
  bestStage: learnedOn ? 1 : 0,
});

const lesson = (id: number, unit: string, best: number): LessonProgress => ({
  lesson: { id, key: `l${id}`, unit, title: "", questionCount: 1 },
  state: best === 0 ? "new" : "managed",
  passed: 0,
  dueDate: null,
  best,
});

describe("greeting", () => {
  it("시각에 맞춰 인사한다", () => {
    expect([2, 8, 12, 15, 20, 23].map(timeGreeting)).toEqual([
      "늦은 시간까지 대단해요",
      "좋은 아침이에요",
      "점심은 드셨나요",
      "좋은 오후예요",
      "좋은 저녁이에요",
      "오늘 하루 수고했어요",
    ]);
  });

  it("상황이 있으면 시각보다 상황을 먼저 말한다", () => {
    const base = { hour: 8, allDone: false, firstDay: false, streak: 3 };
    expect(greeting(base)).toBe("좋은 아침이에요");
    expect(greeting({ ...base, streak: 12 })).toBe("12일째 이어 가고 있어요");
    expect(greeting({ ...base, streak: 12, allDone: true })).toBe("오늘 할 일을 다 했어요");
    expect(greeting({ ...base, firstDay: true })).toBe("반가워요");
  });

  it("이름을 알면 붙인다", () => {
    expect(withName("반가워요", "완자")).toBe("반가워요, 완자님");
    expect(withName("반가워요", null)).toBe("반가워요");
  });
});

describe("lessonsLearnedOn", () => {
  it("그날 배움을 마친 레슨만 센다", () => {
    const concepts = [
      concept(1, "2026-11-28"),
      concept(2, "2026-11-25"),
      concept(3, null),
      // 개념이 둘인 레슨: 하나가 아직이면 세지 않는다
      concept(4, "2026-11-28", 41),
      concept(4, null, 42),
      // 개념이 둘인 레슨: 마지막 개념을 마친 날로 센다
      concept(5, "2026-11-20", 51),
      concept(5, "2026-11-28", 52),
    ];
    expect(lessonsLearnedOn(concepts, new Set(["2026-11-28"]))).toBe(2);
    expect(lessonsLearnedOn(concepts, new Set(["2026-11-25", "2026-11-28"]))).toBe(3);
  });
});

describe("weekBars", () => {
  it("월요일부터 일요일까지 채우고 가장 많이 푼 날을 기준으로 높이를 준다", () => {
    // 2026-11-25는 수요일
    const bars = weekBars("2026-11-25", [
      { date: "2026-11-23", count: 10 },
      { date: "2026-11-25", count: 5 },
    ]);
    expect(bars.map((b) => b.count)).toEqual([10, 0, 5, 0, 0, 0, 0]);
    expect(bars.map((b) => b.ratio)).toEqual([1, 0, 0.5, 0, 0, 0, 0]);
    expect(bars.map((b) => b.isToday)).toEqual([false, false, true, false, false, false, false]);
    expect(bars.map((b) => b.future)).toEqual([false, false, false, true, true, true, true]);
  });

  it("푼 문제가 없어도 0으로 나누지 않는다", () => {
    expect(weekBars("2026-11-25", []).every((b) => b.ratio === 0)).toBe(true);
  });
});

describe("recallPercent", () => {
  it("표본이 모자라면 숫자를 주지 않는다", () => {
    expect(recallPercent({ correct: 4, total: 4 })).toBeNull();
    expect(recallPercent({ correct: 23, total: 28 })).toBe(82);
  });
});

describe("roadmap, unitProgress", () => {
  const lessons = [lesson(1, "자바 언어", 4), lesson(2, "자바 언어", 1), lesson(3, "DB", 0), lesson(4, "자바 언어", 0)];

  it("배운 레슨과 장기 기억 레슨을 센다", () => {
    expect(roadmap(lessons)).toEqual({ total: 4, learned: 2, longTerm: 1 });
  });

  it("과정을 처음 나온 순서대로 묶는다", () => {
    expect(unitProgress(lessons)).toEqual([
      { unit: "자바 언어", total: 3, learned: 2, longTerm: 1 },
      { unit: "DB", total: 1, learned: 0, longTerm: 0 },
    ]);
  });
});
