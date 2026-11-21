"use client";

import { SessionSkeleton } from "@/components/ui/SessionSkeleton";
import { useCallback, useState } from "react";
import { LoadError } from "@/components/ui/LoadError";
import { SessionTopBar } from "@/components/ui/SessionTopBar";
import { api } from "@/lib/api";
import { useRemote } from "@/lib/useRemote";
import { QuestionFlow } from "../solve/QuestionFlow";

export interface RelearnItem {
  conceptId: number;
  conceptName: string;
}

/**
 * 지연 확인에서 틀린 개념을 그날 다시 배운다 (ADR-021, 원칙 4번 successive relearning).
 * 오늘 확인을 다 마친 뒤, 틀린 개념마다 방금과 다른 문제를 맞힐 때까지 낸다. 또 틀리면 그 개념은 맨 뒤로 가서
 * 다른 개념을 푼 다음 또 다른 문제로 다시 나온다. 연습(PRACTICE)으로만 기록하고 일정은 바뀌지 않는다.
 */
export function RelearnSession({ items, onDone }: { items: RelearnItem[]; onDone: () => void }) {
  const [queue, setQueue] = useState(items);
  const [round, setRound] = useState(0);
  const item = queue[0];
  if (!item) return null;

  const solved = items.length - queue.length;
  const advance = (correct: boolean) => {
    const rest = queue.slice(1);
    const nextQueue = correct ? rest : [...rest, item];
    if (nextQueue.length === 0) {
      onDone();
      return;
    }
    setQueue(nextQueue);
    setRound((r) => r + 1);
    window.scrollTo(0, 0);
  };

  return (
    <RelearnQuestion
      key={`${item.conceptId}-${round}`}
      item={item}
      solved={solved}
      total={items.length}
      onlyOneLeft={queue.length === 1}
      onNext={advance}
    />
  );
}

function RelearnQuestion({
  item,
  solved,
  total,
  onlyOneLeft,
  onNext,
}: {
  item: RelearnItem;
  solved: number;
  total: number;
  onlyOneLeft: boolean;
  onNext: (correct: boolean) => void;
}) {
  const fetchQuestion = useCallback(() => api.practiceQuestion(item.conceptId), [item.conceptId]);
  const [load, retry] = useRemote(fetchQuestion);
  const [correct, setCorrect] = useState<boolean | null>(null);

  if (load.status === "loading") {
    return <SessionSkeleton />;
  }
  if (load.status === "error") {
    return <LoadError what="문제를" message={load.message} onRetry={retry} />;
  }

  const finishing = correct === true && onlyOneLeft;
  return (
    <QuestionFlow
      question={load.data}
      context={`${item.conceptName}, 틀린 개념 다시 배우기`}
      mode="PRACTICE"
      topBar={<SessionTopBar title={`다시 배우기 ${solved} / ${total}`} current={solved} total={total} />}
      nextLabel={finishing ? "마치기" : correct === false && onlyOneLeft ? "다른 문제로 다시" : "다음"}
      nextHint={
        correct === false
          ? "해설을 읽고, 이 개념의 다른 문제로 다시 풀어요."
          : correct === true
            ? "다시 배운 것은 연습으로만 남아요. 다음 확인 날은 그대로예요."
            : undefined
      }
      onAnswered={(result) => setCorrect(result.correct)}
      onNext={() => onNext(correct === true)}
    />
  );
}
