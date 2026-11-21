import type { TodayCheck } from "./api/types";

/*
 * 확인 일정 표시 (ADR-017·021: 배운 날 레슨 문제 모두 정답, 그 뒤 3일·7일·21일 재확인, 네 번 통과하면 졸업).
 * 단계 계산은 백엔드 ReviewSchedule이 한다. 화면은 받은 값을 문장으로만 바꾼다.
 */

const ORDINAL = ["", "첫 번째", "두 번째", "세 번째"];

/** 서비스 날짜(YYYY-MM-DD). 하루는 KST 새벽 4시에 바뀐다 (백엔드 ServiceDates와 같다). offsetDays만큼 앞뒤로 옮긴다 */
export function serviceDate(offsetDays = 0, now: number = Date.now()): string {
  const shifted = now + (9 - 4) * 3_600_000 + offsetDays * 86_400_000;
  return new Date(shifted).toISOString().slice(0, 10);
}

/** 두 날짜(YYYY-MM-DD) 사이의 날 수 */
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** 오늘 이 개념을 묻는 이유 */
export function checkReason(check: Pick<TodayCheck, "attemptNo" | "dueDate" | "learnedOn" | "sureWrong">): string {
  if (check.sureWrong) return "확실했는데 틀려서 다시 확인";
  const nth = `${ORDINAL[check.attemptNo] ?? `${check.attemptNo}번째`} 재확인`;
  if (!check.learnedOn) return nth;
  return `배운 지 ${daysBetween(check.learnedOn, check.dueDate)}일, ${nth}`;
}

/** 개념 하나에 2분으로 잡는다 */
export function minutesFor(count: number): number {
  return count * 2;
}
