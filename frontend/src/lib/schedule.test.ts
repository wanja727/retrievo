import { describe, expect, it } from "vitest";
import { checkReason, daysBetween } from "./schedule";

describe("checkReason", () => {
  it("배운 날부터 지난 날 수와 몇 번째 재확인인지 보여준다", () => {
    expect(checkReason({ attemptNo: 1, learnedOn: "2026-11-15", dueDate: "2026-11-18" })).toBe(
      "배운 지 3일, 첫 번째 재확인",
    );
    expect(checkReason({ attemptNo: 3, learnedOn: "2026-10-28", dueDate: "2026-11-18" })).toBe(
      "배운 지 21일, 세 번째 재확인",
    );
  });

});

describe("daysBetween", () => {
  it("달이 바뀌어도 날 수를 센다", () => {
    expect(daysBetween("2026-10-28", "2026-11-18")).toBe(21);
  });
});
