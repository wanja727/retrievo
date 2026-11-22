"use client";

import { SessionSkeleton } from "@/components/ui/SessionSkeleton";
import { RecordChip } from "@/components/ui/Record";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BottomActions, PrimaryButton, TextButton } from "@/components/ui/buttons";
import { CloseIcon, ExternalIcon } from "@/components/ui/icons";
import { LoadError } from "@/components/ui/LoadError";
import { SessionTopBar } from "@/components/ui/SessionTopBar";
import { api } from "@/lib/api";
import {
  isDueToday,
  lessonPageUrl,
  lessonProgress,
  lessonSiteOrigin,
  nextCheckLabel,
  type LessonProgress,
} from "@/lib/lessonProgress";
import { serviceDate } from "@/lib/schedule";
import { useRemote } from "@/lib/useRemote";
import { RetrySolve, type RetrySummary } from "../solve/RetrySolve";

type Phase = "intro" | "solve" | "done";

/**
 * 레슨 하나. 판정 문제를 모두 맞힐 때까지 묻는다. 틀린 문제는 다른 문제를 푼 뒤 다시 나온다.
 * 같은 날 모두 맞히면 배운 날 기준을 통과해 3일 뒤 다시 묻는다 (ADR-017, ADR-021).
 * 이미 배운 레슨(1단계 이상)은 다시 풀어도 연습으로만 기록되고 일정은 바뀌지 않는다.
 * 순서: 레슨 사이트의 본문을 앱 안에 띄움 → 문제 풀기 → 결과 (ADR-024)
 */
export function LessonSession({ lessonId }: { lessonId: number }) {
  const fetchLesson = useCallback(async () => {
    const [lesson, questions, concepts] = await Promise.all([
      api.lesson(lessonId),
      api.lessonQuestions(lessonId),
      api.concepts(),
    ]);
    // 배운 날 기준을 이미 넘은 레슨이면 다시 풀어도 연습이다
    const learned = concepts.some((c) => c.lessonId === lessonId && c.stage >= 1);
    return { lesson, questions, learned };
  }, [lessonId]);
  const [load, retry] = useRemote(fetchLesson);
  const [phaseState, setPhase] = useState<Phase | null>(null);
  const [round, setRound] = useState(0);
  const [summary, setSummary] = useState<RetrySummary | null>(null);
  /**
   * 본문을 아래로 읽는 동안에는 하단 바를 숨긴다. 위로 올리거나 본문 끝에 닿으면 다시 보인다.
   * 본문은 다른 사이트의 페이지라 스크롤을 직접 볼 수 없어서, 레슨 페이지가 postMessage로 알려 준다.
   * 신호가 오지 않으면(예전 레슨 페이지) 바는 계속 보인다
   */
  const [barHidden, setBarHidden] = useState(false);
  useEffect(() => {
    const origin = lessonSiteOrigin();
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin) return;
      const data = e.data as { source?: unknown; type?: unknown; hide?: unknown } | null;
      if (!data || data.source !== "dev-lessons" || data.type !== "bar") return;
      setBarHidden(data.hide === true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (load.status === "loading") {
    return <SessionSkeleton />;
  }
  if (load.status === "error") {
    return <LoadError what="레슨을" message={load.message} onRetry={retry} />;
  }

  const { lesson, questions, learned } = load.data;
  const phase: Phase = phaseState ?? "intro";

  const start = () => {
    setRound((r) => r + 1);
    setSummary(null);
    setPhase("solve");
    window.scrollTo(0, 0);
  };

  if (phase === "intro") {
    // 본문은 레슨 사이트의 페이지를 앱 안에 그대로 띄운다. 본문이 화면 전체를 쓰고, 닫기와 문제 풀기는 본문 위에 뜨는 아래 한 줄에 둔다.
    // 하단 바는 아래로 읽는 동안 숨는다 (barHidden). 레슨 페이지는 바에 가리지 않게 끝에 여백을 둔다.
    // 높이는 fixed inset-0으로 잡는다. dvh를 모르는 브라우저(일부 인앱 브라우저)에서도 본문이 잘리지 않는다.
    // 새 탭에서 크게 보기는 화면이 넓을 때만 보인다 (좁은 화면에서는 이미 화면을 다 쓴다)
    return (
      <main className="fixed inset-0 mx-auto w-full max-w-[430px] overflow-hidden bg-white">
        <iframe
          src={lessonPageUrl(lesson.key, true)}
          title={`${lesson.title} 레슨 본문`}
          className="h-full w-full border-0 bg-white"
        />
        <div
          className={`bottom-bar absolute inset-x-0 bottom-0 flex items-center gap-2 px-4 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] transition-transform duration-200 ease-out motion-reduce:transition-none ${
            barHidden ? "translate-y-full" : ""
          }`}
          // 숨겨진 동안에는 키보드와 화면 낭독기도 지나치게 한다
          inert={barHidden}
        >
          <Link
            href="/lessons"
            aria-label="닫기"
            className="tile flex size-12 shrink-0 items-center justify-center rounded-full text-sub"
          >
            <CloseIcon />
          </Link>
          <PrimaryButton onClick={start} disabled={questions.length === 0} className="h-12! min-w-0 flex-1 text-[15px]!">
            {questions.length === 0
              ? "아직 풀 문제가 없어요"
              : learned
                ? "다시 풀어 보기"
                : `다 읽었으면 문제 ${questions.length}개 풀기`}
          </PrimaryButton>
          <a
            href={lessonPageUrl(lesson.key)}
            target="_blank"
            rel="noreferrer"
            aria-label="레슨 본문을 새 탭에서 크게 보기"
            className="tile hidden size-12 shrink-0 items-center justify-center rounded-full text-sub sm:flex"
          >
            <ExternalIcon />
          </a>
        </div>
      </main>
    );
  }

  if (phase === "done" && summary) {
    return <LessonDone lessonId={lesson.id} summary={summary} onAgain={start} />;
  }

  return (
    <RetrySolve
      key={round}
      questions={questions}
      context={`${lesson.unit} ${lesson.title}`}
      mode="LESSON"
      topBar={(solved, total) => (
        <SessionTopBar title={`${solved} / ${total} 맞힘`} current={solved} total={total} closeHref="/lessons" />
      )}
      finishLabel="마치기"
      onFinish={(done) => {
        setSummary(done);
        setPhase("done");
        window.scrollTo(0, 0);
      }}
    />
  );
}

/** 레슨을 마친 뒤. 처음에 맞힌 수, 다시 풀어 맞힌 수, 이 레슨을 언제 다시 묻는지 */
function LessonDone({
  lessonId,
  summary,
  onAgain,
}: {
  lessonId: number;
  summary: RetrySummary;
  onAgain: () => void;
}) {
  const { total, firstCorrect: correct } = summary;
  const retried = total - correct;
  // 제출할 때 서버가 진행 상태를 바꿨으니 다시 불러온다
  const fetchProgress = useCallback(async () => {
    const [lessons, concepts] = await Promise.all([api.lessons(), api.concepts()]);
    return lessonProgress(lessons, concepts).find((p) => p.lesson.id === lessonId) ?? null;
  }, [lessonId]);
  const [load] = useRemote(fetchProgress);
  const progress = load.status === "ready" ? load.data : null;
  const learning = progress !== null && progress.state === "managed" && progress.passed === 0;

  return (
    <main className="app-frame celebrate">
      <div className="fade-up px-6 pt-24">
        <div className="text-[13px] text-muted">처음에 맞힌 문제</div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-[88px] leading-[0.95] font-semibold tracking-[-5px]">{correct}</span>
          <span className="text-[17px] text-soft">/ {total}</span>
        </div>
        <div className="mt-6 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(total, 1)}, minmax(0, 1fr))` }}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`h-2 rounded-full ${i < correct ? "bar-fill" : "bg-line-strong"}`} />
          ))}
        </div>
        {progress && progress.best >= 1 && (
          <div className="mt-6 flex">
            <RecordChip best={progress.best} />
          </div>
        )}
        {retried > 0 && (
          <p className="mt-6 text-[15px] leading-relaxed text-ink">틀렸던 {retried}문제도 다시 풀어 모두 맞혔어요.</p>
        )}
        <p className={`${retried > 0 ? "mt-2" : "mt-6"} min-h-[3.4em] text-[15px] leading-relaxed text-muted`}>
          {progress && <NextStep progress={progress} />}
        </p>
      </div>
      <BottomActions>
        <PrimaryButton href="/lessons">레슨 목록으로</PrimaryButton>
        {learning && <TextButton onClick={onAgain}>한 번 더 풀기</TextButton>}
      </BottomActions>
    </main>
  );
}

function NextStep({ progress: p }: { progress: LessonProgress }) {
  if (p.state === "graduated") {
    return <>장기 기억이 된 레슨이에요. 다시 풀어도 복습 일정은 바뀌지 않아요.</>;
  }
  if (p.state === "new" || p.passed === 0) {
    return <>아직 배우는 중이에요. 같은 날 문제를 모두 맞히면 3일 뒤에 다시 물어요.</>;
  }
  const today = serviceDate();
  if (isDueToday(p, today)) {
    return <>오늘 확인할 차례예요. 오늘 탭에서 다시 물어요. 레슨에서 다시 푼 것은 연습으로만 남아요.</>;
  }
  return (
    <>
      <b className="font-semibold text-ink">{nextCheckLabel(p, today)}</b>. 그날 다시 물어요. 레슨에서 다시 푼 것은
      연습으로만 남고 일정은 바뀌지 않아요.
    </>
  );
}
