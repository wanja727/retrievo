"use client";

import { SessionSkeleton } from "@/components/ui/SessionSkeleton";
import { useState } from "react";
import { LoadError } from "@/components/ui/LoadError";
import { SessionTopBar } from "@/components/ui/SessionTopBar";
import { api, type SubmissionResult } from "@/lib/api";
import { TOTAL_CHECKS } from "@/lib/stages";
import { useRemote } from "@/lib/useRemote";
import { QuestionFlow } from "../solve/QuestionFlow";
import { DoneView, type RecordGain } from "./DoneView";
import { GraduateView } from "./GraduateView";
import { RelearnSession, type RelearnItem } from "./RelearnSession";
import { TeachStep } from "./TeachStep";

const fetchToday = () => api.todayChecks();

/** 문제를 푼 뒤: 다음 개념으로 가거나, 마지막 확인을 맞혔으면 졸업 확인(가르치듯 설명)과 졸업 화면을 거친다 */
type After = "teach" | "graduate" | null;

/**
 * 오늘의 지연 확인을 하나씩 꺼낸다. 개념마다 처음과 다른 문제 하나.
 * 마지막(21일) 확인을 맞히면 졸업한다: 가르치듯 말해 보기(자기 채점) → 졸업 화면 (20장, ADR-017)
 * 틀린 개념은 확인을 다 마친 뒤 다른 문제를 맞힐 때까지 다시 배운다. 연습으로만 남고 일정은 바뀌지 않는다 (ADR-021)
 */
export function CheckSession() {
  const [load, retry] = useRemote(fetchToday);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<SubmissionResult[]>([]);
  const [after, setAfter] = useState<After>(null);
  /** 오늘 확인에서 틀린 개념. 확인을 다 마친 뒤 다른 문제로 다시 배운다 (ADR-021) */
  const [relearn, setRelearn] = useState<RelearnItem[]>([]);
  const [relearned, setRelearned] = useState(false);
  /** 오늘 확인으로 늘어난 기억 기록. 마친 화면에서 보여준다 */
  const [gains, setGains] = useState<RecordGain[]>([]);

  if (load.status === "loading") {
    return <SessionSkeleton />;
  }
  if (load.status === "error") {
    return <LoadError what="문제를" message={load.message} onRetry={retry} />;
  }

  const checks = load.data;
  if (checks.length === 0 || index >= checks.length) {
    if (relearn.length > 0 && !relearned) {
      return (
        <RelearnSession
          items={relearn}
          onDone={() => {
            setRelearned(true);
            window.scrollTo(0, 0);
          }}
        />
      );
    }
    return (
      <DoneView
        total={checks.length}
        correct={results.filter((r) => r.correct).length}
        relearned={relearn.length}
        gains={gains}
      />
    );
  }

  const check = checks[index];
  const nextLabel = index + 1 < checks.length ? "다음 개념" : "마치기";
  const next = () => {
    setAfter(null);
    setIndex(index + 1);
    window.scrollTo(0, 0);
  };

  if (after === "teach" && check.teach) {
    return (
      <TeachStep
        key={check.conceptId}
        conceptName={check.conceptName}
        prompt={check.teach}
        onDone={() => {
          setAfter("graduate");
          window.scrollTo(0, 0);
        }}
      />
    );
  }
  if (after === "graduate") {
    return (
      <GraduateView
        key={check.conceptId}
        conceptId={check.conceptId}
        conceptName={check.conceptName}
        nextLabel={nextLabel}
        onNext={next}
      />
    );
  }

  const isLastCheck = check.attemptNo === TOTAL_CHECKS - 1;
  const answeredNow = results.length === index + 1;
  const graduated = isLastCheck && answeredNow && results.at(-1)?.correct === true;
  const wrongNow = answeredNow && results.at(-1)?.correct === false;
  return (
    <QuestionFlow
      key={check.question.questionVersionId}
      question={check.question}
      context={`${check.conceptName}, ${isLastCheck ? "21일 뒤 마지막 확인" : "처음과 다른 문제"}`}
      mode="DELAYED_CHECK"
      topBar={<SessionTopBar title={`${index + 1} / ${checks.length}`} current={index + 1} total={checks.length} />}
      nextLabel={
        graduated
          ? check.teach
            ? "가르치듯 설명하기"
            : "장기 기억으로"
          : index + 1 < checks.length
            ? "다음 문제"
            : wrongNow || relearn.length > 0
              ? "틀린 개념 다시 배우기"
              : "마치기"
      }
      nextHint={wrongNow ? "틀린 개념은 오늘 확인을 다 마친 뒤 다른 문제로 다시 배워요." : undefined}
      onAnswered={(result) => {
        setResults((rs) => [...rs, result]);
        const { record } = result;
        if (record) setGains((all) => [...all, { conceptName: check.conceptName, ...record }]);
        if (!result.correct) {
          setRelearn((items) => [...items, { conceptId: check.conceptId, conceptName: check.conceptName }]);
        }
      }}
      onNext={() => {
        if (graduated) setAfter(check.teach ? "teach" : "graduate");
        else next();
        window.scrollTo(0, 0);
      }}
    />
  );
}
