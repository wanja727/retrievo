import { describe, expect, it } from "vitest";
import { recordLabel, recordNote, weekDates } from "./memory";

describe("recordLabel", () => {
  it("가장 높이 도달한 단계를 이름으로 바꾼다", () => {
    expect([0, 1, 2, 3, 4].map(recordLabel)).toEqual(["배우는 중", "학습 완료", "3일 뒤에도 기억", "7일 뒤에도 기억", "장기 기억"]);
    expect(recordLabel(9)).toBe("장기 기억");
  });

  it("기록이 늘면 무엇을 해냈는지 한 줄로 말한다", () => {
    expect(recordNote(1)).toContain("모두 맞혔어요");
    expect(recordNote(3)).toBe("다음에는 21일 뒤에 다시 물어요.");
    expect(recordNote(4)).toContain("복습에서 빼요");
  });
});

describe("weekDates", () => {
  it("그 주의 월요일부터 일요일까지를 준다", () => {
    // 2026-11-22는 일요일, 2026-11-23은 월요일
    expect(weekDates("2026-11-22")).toEqual([
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);
    expect(weekDates("2026-11-23")[0]).toBe("2026-11-23");
  });
});
