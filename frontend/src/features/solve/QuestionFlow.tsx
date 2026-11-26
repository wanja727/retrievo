"use client";

import { useState, type ReactNode } from "react";
import { BottomActions, PrimaryButton } from "@/components/ui/buttons";
import { api, type QuestionView, type SubmissionMode, type SubmissionResult } from "@/lib/api";
import { choiceOrder } from "@/lib/grading";
import { ChooseStep } from "./ChooseStep";
import { ResultStep } from "./ResultStep";

type Step = "choose" | "result";

/**
 * 문제 하나를 푸는 흐름: 보기 → 해설.
 * 보기를 열기 전에 답을 먼저 적게 하던 단계는 뺐다. 잘 만든 객관식만으로도 인출 효과가 거의 같고
 * (Smith & Karpicke 2014, Little 외 2012), 직접 써 보니 불편이 컸다 (ADR-022).
 * 정답과 해설은 제출한 뒤에만 받는다 (답 먼저). 레슨과 지연 확인이 같이 쓴다.
 * 다음 문제로 넘어갈 때는 key를 바꿔 새로 만든다 (상태를 문제마다 새로 시작).
 */
export function QuestionFlow({
  question,
  context,
  mode,
  topBar,
  nextLabel,
  nextHint,
  onAnswered,
  onNext,
}: {
  question: QuestionView;
  context: string;
  mode: SubmissionMode;
  topBar: ReactNode;
  nextLabel: string;
  /** 해설 화면에서 다음 버튼 아래에 붙이는 안내 (예: 틀린 문제는 뒤에서 다시 나온다) */
  nextHint?: string;
  onAnswered: (result: SubmissionResult) => void;
  onNext: () => void;
}) {
  const [step, setStepState] = useState<Step>("choose");
  /**
   * 처음 제출할 때 만들고 이 문제 동안 다시 쓴다.
   * 응답을 못 받아 다시 보내도 서버가 처음 결과를 돌려준다 (재시도·두 번 누르기)
   */
  const [clientSubmissionId, setClientSubmissionId] = useState<string | null>(null);
  /** 보기 순서는 문제를 열 때 한 번 섞고, 고르는 동안에는 그대로 둔다 */
  const [order] = useState(() => choiceOrder(question.choices ?? []));
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const setStep = (s: Step) => {
    setStepState(s);
    window.scrollTo(0, 0);
  };

  const submit = async () => {
    if (!selected) return;
    const id = clientSubmissionId ?? crypto.randomUUID();
    setClientSubmissionId(id);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const answered = await api.submit({
        clientSubmissionId: id,
        questionVersionId: question.questionVersionId,
        selected,
        mode,
      });
      setResult(answered);
      onAnswered(answered);
      setStep("result");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "제출하지 못했어요");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "choose" || !result) {
    return (
      <main className="app-frame">
        {topBar}
        <ChooseStep
          question={question}
          context={context}
          order={order}
          selected={selected}
          onSelect={setSelected}
        />
        <BottomActions>
          {submitError && <p className="pb-2 text-center text-[13px] text-wrong">{submitError}</p>}
          <PrimaryButton onClick={submit} disabled={!selected || submitting}>
            {submitting ? "채점하는 중" : "제출"}
          </PrimaryButton>
          {!selected && <p className="pt-2 text-center text-[13px] text-soft">답을 고르면 제출할 수 있어요</p>}
        </BottomActions>
      </main>
    );
  }

  return (
    <main className="app-frame">
      {topBar}
      <ResultStep question={question} result={result} />
      <BottomActions>
        <PrimaryButton
          onClick={() => {
            window.scrollTo(0, 0);
            onNext();
          }}
        >
          {nextLabel}
        </PrimaryButton>
        {nextHint && <p className="pt-2 text-center text-[13px] text-soft">{nextHint}</p>}
      </BottomActions>
    </main>
  );
}
