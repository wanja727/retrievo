import { describe, expect, it } from "vitest";
import type { ConceptStatus, LessonSummary } from "./api/types";
import {
  appLessonHref,
  asLessonSection,
  byNextCheck,
  isDueToday,
  lessonPageUrl,
  lessonProgress,
  nextCheckLabel,
} from "./lessonProgress";
import { serviceDate } from "./schedule";

const lesson = (id: number): LessonSummary => ({ id, key: `l${id}`, unit: "JPA", title: `레슨 ${id}`, questionCount: 8 });

function concept(lessonId: number, patch: Partial<ConceptStatus>): ConceptStatus {
  return {
    conceptId: lessonId * 10,
    conceptName: "개념",
    lessonId,
    lessonTitle: `레슨 ${lessonId}`,
    stage: 1,
    graduated: false,
    learnedOn: "2026-11-15",
    dueDate: "2026-11-18",
    graduatedAt: null,
    bestStage: 1,
    ...patch,
  };
}

const TODAY = "2026-11-18";

describe("lessonProgress", () => {
  it("풀어 본 개념이 없으면 시작 전, 모두 졸업이면 졸업, 나머지는 관리 중이다", () => {
    const [fresh, done, managed] = lessonProgress(
      [lesson(1), lesson(2), lesson(3)],
      [concept(2, { stage: 4, graduated: true, dueDate: null }), concept(3, { stage: 2, dueDate: "2026-11-22" })],
    );
    expect(fresh.state).toBe("new");
    expect(done.state).toBe("graduated");
    expect(managed).toMatchObject({ state: "managed", passed: 2, dueDate: "2026-11-22" });
  });

  it("개념이 여럿이면 졸업하지 않은 개념 중 가장 늦은 단계와 가장 가까운 확인일을 쓴다", () => {
    const [p] = lessonProgress(
      [lesson(1)],
      [
        concept(1, { conceptId: 1, stage: 3, dueDate: "2026-11-30" }),
        concept(1, { conceptId: 2, stage: 1, dueDate: "2026-11-20" }),
        concept(1, { conceptId: 3, stage: 4, graduated: true, dueDate: null }),
      ],
    );
    expect(p).toMatchObject({ state: "managed", passed: 1, dueDate: "2026-11-20" });
  });
});

describe("nextCheckLabel", () => {
  const managed = (patch: Partial<ConceptStatus>) => lessonProgress([lesson(1)], [concept(1, patch)])[0];

  it("언제 다시 묻는지 보여준다", () => {
    expect(nextCheckLabel(managed({ stage: 0, dueDate: null, learnedOn: null }), TODAY)).toBe(
      "같은 날 모두 맞히면 학습 완료",
    );
    expect(nextCheckLabel(managed({ dueDate: TODAY }), TODAY)).toBe("오늘 확인");
    expect(nextCheckLabel(managed({ dueDate: "2026-11-15" }), TODAY)).toBe("오늘 확인");
    expect(nextCheckLabel(managed({ stage: 2, dueDate: "2026-11-23" }), TODAY)).toBe("5일 뒤 확인");
    expect(nextCheckLabel(managed({ stage: 3, dueDate: "2026-11-30" }), TODAY)).toBe("12일 뒤 확인");
  });

  it("확인일이 오늘이거나 지났으면 오늘 확인할 레슨이다", () => {
    expect(isDueToday(managed({ dueDate: "2026-11-17" }), TODAY)).toBe(true);
    expect(isDueToday(managed({ dueDate: "2026-11-19" }), TODAY)).toBe(false);
  });
});

describe("byNextCheck", () => {
  it("배우는 중을 맨 앞에, 나머지는 다음 확인이 가까운 순으로 둔다", () => {
    const list = lessonProgress(
      [lesson(1), lesson(2), lesson(3)],
      [
        concept(1, { dueDate: "2026-11-25" }),
        concept(2, { stage: 0, dueDate: null, learnedOn: null }),
        concept(3, { dueDate: "2026-11-19" }),
      ],
    );
    expect([...list].sort(byNextCheck).map((p) => p.lesson.id)).toEqual([2, 3, 1]);
  });
});

describe("serviceDate", () => {
  it("하루는 KST 새벽 4시에 바뀐다", () => {
    // 2026-11-18 03:59 KST = 2026-11-17 18:59 UTC → 아직 17일
    expect(serviceDate(0, Date.parse("2026-11-17T18:59:00Z"))).toBe("2026-11-17");
    // 2026-11-18 04:00 KST
    expect(serviceDate(0, Date.parse("2026-11-17T19:00:00Z"))).toBe("2026-11-18");
    expect(serviceDate(3, Date.parse("2026-11-17T19:00:00Z"))).toBe("2026-11-21");
  });
});

describe("찾아보기에서 레슨으로", () => {
  it("레슨 키를 앱의 레슨 화면 주소로 바꾸고, 구역은 at으로 남긴다", () => {
    const lessons = [lesson(3), lesson(7)];
    expect(appLessonHref(lessons, "l7", "q3")).toBe("/lessons/7?at=q3");
    expect(appLessonHref(lessons, "l3")).toBe("/lessons/3");
  });

  it("앱에 없는 레슨이면 null이다", () => {
    expect(appLessonHref([lesson(3)], "inheritance-embedded", "q1")).toBeNull();
  });

  it("구역은 질문 id와 practice만 받는다", () => {
    expect(asLessonSection("q3")).toBe("q3");
    expect(asLessonSection("practice")).toBe("practice");
    expect(asLessonSection("q0")).toBeUndefined();
    expect(asLessonSection("q3#x")).toBeUndefined();
    expect(asLessonSection(undefined)).toBeUndefined();
  });

  it("레슨 본문 주소에 구역을 #앵커로 붙인다", () => {
    expect(lessonPageUrl("jpa-basics", true, "q2")).toMatch(/\/lessons\/jpa-basics\/\?embed=1#q2$/);
    expect(lessonPageUrl("jpa-basics", true)).toMatch(/\/lessons\/jpa-basics\/\?embed=1$/);
  });
});
