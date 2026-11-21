/*
 * 사용자에게 보여주는 성장 값. 모두 쌓이기만 하고 줄지 않는다.
 * - 기억 기록: 개념을 가장 길게 기억한 기록. 틀려도 줄지 않는다 (다음 확인만 빨라지고, 그건 시스템이 관리한다)
 * - 연속 학습: 답을 낸 날이 이어진 일수
 * - 배운 개념, 장기 기억 개념, 꺼낸 횟수: 누적
 * 배운 날 레슨 문제를 모두 맞히면 "학습 완료"다. 그 뒤의 확인은 이해가 아니라 기억이 얼마나 오래 가는지를 잰다.
 */

/** 기억 기록의 이름. 순서는 지금까지 도달한 가장 높은 단계(0 = 배우는 중, 4 = 장기 기억: 21일 뒤에도 기억함) */
const RECORD_LABEL = ["배우는 중", "학습 완료", "3일 뒤에도 기억", "7일 뒤에도 기억", "장기 기억"] as const;

export function recordLabel(bestStage: number): string {
  return RECORD_LABEL[Math.max(0, Math.min(bestStage, RECORD_LABEL.length - 1))];
}

/** 기록이 늘었을 때 붙이는 한 줄 */
export function recordNote(bestStage: number): string {
  if (bestStage >= 4) return "21일 뒤에도 기억했어요. 이제 복습에서 빼요.";
  if (bestStage === 3) return "다음에는 21일 뒤에 다시 물어요.";
  if (bestStage === 2) return "다음에는 7일 뒤에 다시 물어요.";
  return "레슨 문제를 모두 맞혔어요. 3일 뒤에 다른 문제로 다시 물어요.";
}

export const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

/** today(YYYY-MM-DD)가 있는 주의 월요일부터 일요일까지 */
export function weekDates(today: string): string[] {
  const ms = Date.parse(`${today}T00:00:00Z`);
  const fromMonday = (new Date(ms).getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => new Date(ms + (i - fromMonday) * 86_400_000).toISOString().slice(0, 10));
}
