import { describe, expect, it } from "vitest";
import { choiceOrder, describeAnswer, formatLines, isCorrect, parseLines } from "./grading";

describe("줄 고르기", () => {
  it("순서와 공백, 중복을 무시하고 집합으로 비교한다", () => {
    expect(parseLines("8, 7,7")).toEqual([7, 8]);
    expect(formatLines([8, 7])).toBe("7,8");
    expect(isCorrect("LINE_PICK", "8,7", "7, 8")).toBe(true);
    expect(isCorrect("LINE_PICK", "7", "7, 8")).toBe(false);
    expect(isCorrect("LINE_PICK", "", "7")).toBe(false);
  });
});

describe("보기와 OX", () => {
  it("OX는 대소문자를 가리지 않는다", () => {
    expect(isCorrect("OX", "x", "X")).toBe(true);
  });

  it("보기 번호를 보기 내용으로 바꿔 보여준다", () => {
    expect(describeAnswer("MULTIPLE_CHOICE", "4", ["1번", "2번", "10번", "11번"])).toBe("11번");
    expect(describeAnswer("LINE_PICK", "8,4", null)).toBe("4, 8번째 줄");
  });
});

describe("보기 순서", () => {
  it("섞어도 보기는 빠지거나 겹치지 않는다", () => {
    const order = choiceOrder(["남는다", "남지 않는다", "오류가 난다", "기다린다"]);
    expect([...order].sort()).toEqual([0, 1, 2, 3]);
  });

  it("난수에 따라 순서가 바뀐다", () => {
    const choices = ["남는다", "남지 않는다", "오류가 난다", "기다린다"];
    expect(choiceOrder(choices, () => 0)).toEqual([1, 2, 3, 0]);
    expect(choiceOrder(choices, () => 0.999)).toEqual([0, 1, 2, 3]);
  });

  it("보기가 모두 수이면 적힌 순서 그대로 둔다", () => {
    expect(choiceOrder(["1번", "3번", "4번", "251번"], () => 0)).toEqual([0, 1, 2, 3]);
    expect(choiceOrder(["100", "50", "1,024", "0.2초"], () => 0)).toEqual([0, 1, 2, 3]);
  });

  it("수와 글이 섞인 보기는 섞는다", () => {
    expect(choiceOrder(["100", "50", "오류가 난다"], () => 0)).toEqual([1, 2, 0]);
  });
});
