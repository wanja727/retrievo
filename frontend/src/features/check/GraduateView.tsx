"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { api } from "@/lib/api";
import { lessonProgress } from "@/lib/lessonProgress";
import { TOTAL_CHECKS } from "@/lib/stages";
import { useRemote } from "@/lib/useRemote";

const STEP_LABELS = ["배운 날", "3일", "7일", "21일"];

/** 움직임이 시작되기까지. 화면이 자리 잡은 뒤 마지막 칸이 차오른다 */
const MOTION_DELAY_MS = 700;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 졸업 (보상 화면, ADR-023): 라벤더가 넓게 번지는 밝은 화면. 마지막 칸이 차오르고 졸업한 레슨 수가 하나 오른다.
 * 움직임을 줄이도록 설정한 사람에게는 끝난 상태를 바로 보여준다.
 */
export function GraduateView({
  conceptId,
  conceptName,
  nextLabel,
  onNext,
}: {
  conceptId: number;
  conceptName: string;
  nextLabel: string;
  onNext: () => void;
}) {
  const [done, setDone] = useState(false);

  // 졸업은 제출할 때 서버가 이미 기록했다. 레슨 단위로 몇 개가 졸업했는지 다시 센다
  const fetchLessons = useCallback(async () => {
    const [lessons, concepts] = await Promise.all([api.lessons(), api.concepts()]);
    const progress = lessonProgress(lessons, concepts);
    const lessonId = concepts.find((c) => c.conceptId === conceptId)?.lessonId;
    const lessonGraduated = progress.some((p) => p.lesson.id === lessonId && p.state === "graduated");
    return {
      total: progress.length,
      graduated: progress.filter((p) => p.state === "graduated").length,
      lessonGraduated,
    };
  }, [conceptId]);
  const [load] = useRemote(fetchLessons);

  useEffect(() => {
    const timer = setTimeout(() => setDone(true), prefersReducedMotion() ? 0 : MOTION_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const counts = load.status === "ready" ? load.data : null;
  // 이 개념으로 레슨까지 졸업했으면 움직임 전에는 하나 적게 보여준다
  const shownGraduated = counts ? counts.graduated - (counts.lessonGraduated && !done ? 1 : 0) : null;
  const filled = done ? TOTAL_CHECKS : TOTAL_CHECKS - 1;

  return (
    <main className="app-frame celebrate">
      <header className="grid h-14 shrink-0 grid-cols-[44px_1fr_44px] items-center px-3">
        <Link href="/" aria-label="닫기" className="flex size-11 items-center justify-center text-muted">
          <CloseIcon />
        </Link>
      </header>

      <section className="px-6 pt-16" aria-live="polite">
        <div className={`flex items-center gap-2 text-[13px] transition-colors duration-500 ${done ? "font-semibold text-accent-ink" : "text-muted"}`}>
          <span
            className={`size-1.5 rounded-full transition-colors duration-500 ${done ? "bg-accent" : "bg-faint"}`}
            aria-hidden="true"
          />
          {done ? "장기 기억" : "마지막 확인 통과"}
        </div>
        <h1 className="mt-3 text-[40px] leading-[1.15] font-semibold tracking-[-1.5px] break-keep">{conceptName}</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          {done ? "21일에 걸쳐 네 번 모두 꺼냈어요. 이제 복습에서 빼요." : "네 번째 확인을 맞혔어요."}
        </p>
      </section>

      <div
        role="img"
        aria-label={`확인 ${TOTAL_CHECKS}번 중 ${filled}번 통과`}
        className="mx-6 mt-12 grid grid-cols-4 gap-1.5"
      >
        {STEP_LABELS.map((label, i) => (
          <div key={label}>
            <div className="h-2 overflow-hidden rounded-full bg-line-strong">
              <div
                className={`bar-fill h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none ${
                  i < filled ? "w-full" : "w-0"
                }`}
              />
            </div>
            <div className={`mt-2 text-[11px] ${i < filled ? "font-medium text-ink" : "text-soft"}`}>{label}</div>
          </div>
        ))}
      </div>

      {counts && shownGraduated !== null && (
        <section className="card mx-4 mt-10 px-5 py-5" aria-label="장기 기억이 된 레슨">
          <div className="text-[13px] text-muted">장기 기억이 된 레슨</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className={`text-[40px] font-semibold tracking-[-1.5px] transition-colors duration-500 ${done ? "text-accent-ink" : "text-soft"}`}>
              {shownGraduated}
            </span>
            <span className="text-[15px] text-soft">/ {counts.total}</span>
          </div>
          <div
            className="mt-3 grid gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${Math.max(counts.total, 1)}, minmax(0, 1fr))` }}
            aria-hidden="true"
          >
            {Array.from({ length: counts.total }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-colors duration-500 ${i < shownGraduated ? "bar-fill" : "bg-line-strong"}`}
              />
            ))}
          </div>
          {!counts.lessonGraduated && (
            <p className="mt-3 text-[13px] leading-relaxed text-soft">
              이 레슨에는 아직 장기 기억이 되지 않은 개념이 남아 있어요.
            </p>
          )}
        </section>
      )}

      <div className="bottom-bar sticky bottom-0 mt-auto px-6 pt-4 pb-6">
        <button
          type="button"
          onClick={onNext}
          disabled={!done}
          className={`flex h-14 w-full items-center justify-center rounded-full text-[17px] font-semibold transition-colors duration-500 ${
            done ? "btn-primary text-white" : "bg-line-strong text-soft"
          }`}
        >
          {nextLabel}
        </button>
      </div>
    </main>
  );
}
