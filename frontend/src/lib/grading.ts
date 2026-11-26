import type { QuestionType } from "./api/types";

/** 줄 고르기 답("7, 8", "8,7")을 정렬된 줄 번호 목록으로 바꾼다 */
export function parseLines(value: string): number[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ].sort((a, b) => a - b);
}

export function formatLines(lines: Iterable<number>): string {
  return [...new Set(lines)].sort((a, b) => a - b).join(",");
}

/** 백엔드 Grading과 같은 규칙. 목 API가 쓴다 */
export function isCorrect(type: QuestionType, selected: string, answer: string): boolean {
  if (type === "LINE_PICK") {
    const a = parseLines(selected);
    const b = parseLines(answer);
    return a.length > 0 && a.length === b.length && a.every((n, i) => n === b[i]);
  }
  return selected.trim().toUpperCase() === answer.trim().toUpperCase();
}

/**
 * 보기를 보여 줄 순서 (원래 자리의 번호, 0부터). 문제를 열 때마다 섞어서 정답의 자리를 외우지 못하게 한다.
 * 문제 파일의 정답은 2번에 몰려 있다 (2026-11-26에 세어 보니 보기 4개 문제의 63%).
 * 보기가 모두 "3번", "250ms" 같은 수이면 적힌 순서가 크기 순서라서 그대로 둔다.
 * 제출하는 값은 원래 번호 그대로라서 채점과 기록은 바뀌지 않는다.
 */
export function choiceOrder(choices: string[], random: () => number = Math.random): number[] {
  const order = choices.map((_, i) => i);
  if (choices.every((c) => /^\d[\d.,]*\s*[^\s\d]{0,4}$/.test(c.trim()))) return order;
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** 화면에 보여줄 답 문구. 보기 번호는 보기 내용으로, 줄 번호는 "4번째 줄"로 */
export function describeAnswer(type: QuestionType, value: string, choices: string[] | null): string {
  if (type === "LINE_PICK") {
    const lines = parseLines(value);
    return lines.length === 0 ? "-" : `${lines.join(", ")}번째 줄`;
  }
  if (type === "OX") return value.toUpperCase();
  const index = Number.parseInt(value, 10) - 1;
  return choices?.[index] ?? value;
}
