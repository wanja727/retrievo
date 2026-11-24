"use client";

import { SessionSkeleton } from "@/components/ui/SessionSkeleton";
import { RecordChip } from "@/components/ui/Record";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BottomActions, PrimaryButton, TextButton } from "@/components/ui/buttons";
import { CloseIcon } from "@/components/ui/icons";
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

/** 레슨 본문의 구역 하나가 시작하는 위치 (본문 맨 위에서부터의 px) */
type Mark = { label: string; top: number };
function isMark(m: unknown): m is Mark {
  const v = m as { label?: unknown; top?: unknown } | null;
  return !!v && typeof v.label === "string" && v.label.length <= 40 && typeof v.top === "number";
}

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
   * 본문은 다른 사이트의 페이지라 앱이 그 안을 볼 수 없다. 레슨 페이지가 postMessage로 알려 준다.
   * - height: 본문의 높이. iframe을 이 높이로 맞춘다. 그러면 본문이 iframe 안에서 따로 스크롤되지 않고
   *   앱의 페이지 전체가 스크롤되어, 모바일 브라우저의 주소창이 접힌다
   * - marks: 구역(예측, 질문 1...)이 시작하는 위치. 지금 읽는 곳을 보여 주는 데 쓴다
   * - scroll: 본문 안의 #링크를 눌렀을 때 가야 할 위치
   * - bar: 높이를 알려 주지 않는 예전 레슨 페이지가 보내는 신호. 하단 바를 숨길지 알려 준다
   */
  const [frameHeight, setFrameHeight] = useState<number | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [where, setWhere] = useState("");
  const [barHidden, setBarHidden] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const origin = lessonSiteOrigin();
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin) return;
      const data = e.data as { source?: unknown; type?: unknown; hide?: unknown; height?: unknown; top?: unknown; marks?: unknown } | null;
      if (!data || data.source !== "dev-lessons") return;
      if (data.type === "height" && typeof data.height === "number" && data.height >= 200 && data.height <= 200_000) {
        setFrameHeight(Math.ceil(data.height));
      } else if (data.type === "marks" && Array.isArray(data.marks)) {
        setMarks(data.marks.slice(0, 12).filter(isMark));
      } else if (data.type === "scroll" && typeof data.top === "number" && frameRef.current) {
        const frameTop = frameRef.current.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: Math.max(0, frameTop + data.top - 12), behavior: "smooth" });
      } else if (data.type === "bar") {
        setBarHidden(data.hide === true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  /**
   * iframe이 본문 높이에 맞춰진 뒤에는 앱의 스크롤로 진행 표시와 하단 바를 정한다.
   * 아래로 읽는 동안에는 하단 바를 숨기고, 위로 올리거나 처음과 끝에 닿으면 다시 보인다
   */
  const fitted = frameHeight !== null;
  useEffect(() => {
    if (!fitted) return;
    let lastY = window.scrollY;
    const update = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progressRef.current) progressRef.current.style.width = `${max > 0 ? Math.min(100, (y / max) * 100) : 0}%`;
      const frameTop = frameRef.current ? frameRef.current.getBoundingClientRect().top : 0;
      let label = "";
      for (const m of marks) if (frameTop + m.top < window.innerHeight * 0.4) label = m.label;
      setWhere(label);
      const dir = y > lastY + 6 ? "down" : y < lastY - 6 ? "up" : "";
      if (dir) lastY = y;
      if (y < 40 || max - y < 160) setBarHidden(false);
      else if (dir) setBarHidden(dir === "down");
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [fitted, marks, frameHeight]);

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
    // 본문은 레슨 사이트의 페이지를 앱 안에 그대로 띄운다. 본문이 화면 폭을 다 쓰고(넓은 화면에서는 넓게),
    // 닫기와 문제 풀기는 화면 아래에 붙은 한 줄에 둔다. 하단 바는 아래로 읽는 동안 숨는다 (barHidden).
    // iframe의 높이는 레슨 페이지가 알려 준 본문 높이다. 알려 주기 전에는 화면 높이로 두고 그 안에서 스크롤한다
    return (
      <main className="relative min-h-dvh w-full bg-white">
        {fitted && (
          <div className="pointer-events-none fixed inset-x-0 top-0 z-20 h-[3px]" aria-hidden="true">
            <span ref={progressRef} className="block h-full w-0 rounded-r-[3px] bg-accent" />
          </div>
        )}
        {fitted && where && (
          <div className="pointer-events-none fixed top-3 right-3 z-20 rounded-full border border-line bg-white/90 px-[11px] py-[3px] text-[12.5px] font-semibold text-muted backdrop-blur-sm">
            {where}
          </div>
        )}
        <iframe
          ref={frameRef}
          src={lessonPageUrl(lesson.key, true)}
          title={`${lesson.title} 레슨 본문`}
          className="block w-full border-0 bg-white"
          style={{ height: fitted ? `${frameHeight}px` : "100dvh" }}
          scrolling={fitted ? "no" : undefined}
        />
        <div
          className={`bottom-bar fixed inset-x-0 bottom-0 z-10 px-4 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] transition-transform duration-200 ease-out motion-reduce:transition-none ${
            barHidden ? "translate-y-full" : ""
          }`}
          // 숨겨진 동안에는 키보드와 화면 낭독기도 지나치게 한다
          inert={barHidden}
        >
          {/* 넓은 화면에서도 버튼은 가운데에 손에 닿는 폭으로 둔다 */}
          <div className="mx-auto flex w-full max-w-[560px] items-center gap-2">
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
          </div>
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
