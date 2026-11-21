"use client";

import { useState, type ReactNode } from "react";
import type { QuestionView, SubmissionMode } from "@/lib/api";
import {
  answer,
  current,
  finishesAfterThis,
  firstCorrectCount,
  isRetry,
  next,
  retriesRightAway,
  solvedCount,
  startQueue,
} from "@/lib/retryQueue";
import { QuestionFlow } from "./QuestionFlow";

/** 문제를 모두 맞힌 뒤 화면에 넘기는 요약. firstCorrect: 처음 낸 답으로 맞힌 문제 수 */
export interface RetrySummary {
  total: number;
  firstCorrect: number;
}

/**
 * 문제를 모두 한 번씩 맞힐 때까지 낸다 (ADR-021, 원칙 4번).
 * 틀린 문제는 해설을 본 뒤 다른 문제를 풀고 나서 다시 나온다. 레슨과 레슨 본문의 확인 단계가 같이 쓴다.
 */
export function RetrySolve({
  questions,
  context,
  mode,
  topBar,
  finishLabel,
  onFinish,
}: {
  questions: QuestionView[];
  context: string;
  mode: SubmissionMode;
  /** 맞힌 문제 수와 전체 수로 상단 막대를 만든다 */
  topBar: (solved: number, total: number) => ReactNode;
  finishLabel: string;
  onFinish: (summary: RetrySummary) => void;
}) {
  const [queue, setQueue] = useState(() => startQueue(questions.length));
  const index = current(queue);
  if (index === null) return null;

  const question = questions[index];
  // 같은 문제를 다시 낼 때도 새로 시작하도록, 몇 번째로 내는 문제인지를 key에 넣는다
  const shown = queue.attempts - (queue.answered === null ? 0 : 1);
  const retry = isRetry(queue);
  const finishing = finishesAfterThis(queue);
  const nextLabel = finishing ? finishLabel : retriesRightAway(queue) ? "다시 풀기" : "다음 문제";
  const nextHint =
    queue.answered === false
      ? retriesRightAway(queue)
        ? "해설을 읽었으면 이 문제를 다시 풀어요."
        : "틀린 문제는 다른 문제를 푼 뒤에 다시 나와요."
      : undefined;

  return (
    <QuestionFlow
      key={`${index}-${shown}`}
      question={question}
      context={retry ? `${context}, 틀렸던 문제 다시` : context}
      mode={mode}
      topBar={topBar(solvedCount(queue), questions.length)}
      nextLabel={nextLabel}
      nextHint={nextHint}
      onAnswered={(result) => setQueue((q) => answer(q, result.correct))}
      onNext={() => {
        if (finishing) {
          onFinish({ total: questions.length, firstCorrect: firstCorrectCount(queue) });
        } else {
          setQueue((q) => next(q));
        }
      }}
    />
  );
}
