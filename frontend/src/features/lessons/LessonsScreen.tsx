"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { ArrowRightIcon } from "@/components/ui/icons";
import { LoadError } from "@/components/ui/LoadError";
import { RecordChip } from "@/components/ui/Record";
import { api } from "@/lib/api";
import {
  byNextCheck,
  isDueToday,
  lessonProgress,
  nextCheckLabel,
  type LessonProgress,
} from "@/lib/lessonProgress";
import { serviceDate } from "@/lib/schedule";
import { useClientValue, useRemote } from "@/lib/useRemote";
import { FirstRunSheet } from "../today/FirstRunSheet";

const fetchLessons = async () => {
  const [lessons, concepts] = await Promise.all([api.lessons(), api.concepts()]);
  return lessonProgress(lessons, concepts);
};

/**
 * 레슨 목록. 레슨마다 기억 기록(학습 완료, 3일·7일 뒤에도 기억, 장기 기억)을 보여준다. 가장 길게 기억한 기록이라 줄지 않는다.
 * 지금 몇 번째 확인인지는 시스템이 관리할 일이라 보여주지 않는다.
 * 기억하는 중인 레슨을 다음 확인이 가까운 순으로 보여주고, 21일 뒤에도 기억한 레슨은 복습에서 뺐다고 알린다.
 */
export function LessonsScreen() {
  const [state, retry] = useRemote(fetchLessons);
  const today = useClientValue(() => serviceDate(), "");
  const [helpOpen, setHelpOpen] = useState(false);

  if (state.status === "error") {
    return <LoadError what="레슨을" message={state.message} onRetry={retry} />;
  }

  const all = state.status === "ready" ? state.data : [];
  const managed = all.filter((p) => p.state === "managed").sort(byNextCheck);
  const graduated = all.filter((p) => p.state === "graduated");
  const fresh = all.filter((p) => p.state === "new");

  return (
    <main className="app-frame">
      <header className="flex h-14 shrink-0 items-center px-6">
        <h1 className="text-[17px] font-semibold tracking-[-0.3px]">레슨</h1>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label="숫자의 뜻"
          className="ml-auto inline-flex size-6 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-ink"
        >
          ?
        </button>
      </header>

      {state.status === "loading" ? (
        <div className="hero mx-4 mt-1 px-6 py-6" aria-busy="true" aria-label="불러오는 중">
          <div className="h-10 w-40 rounded bg-white/70" />
          <div className="mt-4 h-2 rounded bg-white/70" />
        </div>
      ) : (
        <Summary all={all} graduated={graduated.length} fresh={fresh.length} />
      )}

      {managed.length > 0 && (
        <section className="mx-4 mt-6 flex flex-col gap-2" aria-labelledby="managed-title">
          <SectionLabel id="managed-title" note="다음 확인이 가까운 순">
            기억하는 중 {managed.length}
          </SectionLabel>
          {managed.map((p) => (
            <ManagedRow key={p.lesson.id} progress={p} today={today} />
          ))}
        </section>
      )}

      {fresh.length > 0 && (
        <section className="mx-4 mt-6 flex flex-col gap-2" aria-labelledby="fresh-title">
          <SectionLabel id="fresh-title">시작 전 {fresh.length}</SectionLabel>
          {fresh.map((p) => (
            <Link
              key={p.lesson.id}
              href={`/lessons/${p.lesson.id}`}
              className="card flex h-[62px] items-center gap-3 px-4"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium tracking-[-0.2px]">{p.lesson.title}</div>
                <div className="mt-0.5 text-[13px] text-soft">{p.lesson.unit}</div>
              </div>
              <ArrowRightIcon size={16} className="text-faint" />
            </Link>
          ))}
        </section>
      )}

      {graduated.length > 0 && (
        <section className="mx-4 mt-6 flex flex-col gap-2" aria-labelledby="graduated-title">
          <SectionLabel id="graduated-title" note="복습에서 뺐어요">
            장기 기억 {graduated.length}
          </SectionLabel>
          {graduated.map((p) => (
            <Link
              key={p.lesson.id}
              href={`/lessons/${p.lesson.id}`}
              className="card flex h-[62px] items-center gap-3 px-4"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium tracking-[-0.2px]">{p.lesson.title}</div>
                <div className="mt-0.5 text-[13px] text-soft">{p.lesson.unit}</div>
              </div>
              <RecordChip best={p.best} />
            </Link>
          ))}
        </section>
      )}

      <div className="mt-auto pt-6" />
      <BottomNav active="레슨" />

      {helpOpen && <FirstRunSheet title="숫자의 뜻" onClose={() => setHelpOpen(false)} />}
    </main>
  );
}

function SectionLabel({ id, children, note }: { id: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="flex items-baseline justify-between px-2 pb-0.5">
      <h2 id={id} className="text-[13px] font-semibold text-sub">
        {children}
      </h2>
      {note && <span className="text-[13px] text-soft">{note}</span>}
    </div>
  );
}

/** 배운 레슨 수와 비율 막대. 레슨이 몇 개로 늘어도 모양이 같도록, 레슨마다 한 칸이 아니라 세 구간의 비율로 그린다 */
function Summary({ all, graduated, fresh }: { all: LessonProgress[]; graduated: number; fresh: number }) {
  const learned = all.filter((p) => p.best >= 1).length;
  return (
    <section className="hero mx-4 mt-1 px-6 pt-5 pb-6" aria-labelledby="summary-title">
      <h2 id="summary-title" className="text-[13px] text-muted">
        배운 레슨
      </h2>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[56px] leading-none font-semibold tracking-[-2.5px]">{learned}</span>
        <span className="text-[22px] font-medium text-soft">/ {all.length}</span>
      </div>
      <div
        role="img"
        aria-label={`레슨 ${all.length}개 가운데 ${learned}개를 배웠고 ${graduated}개는 장기 기억`}
        className="mt-4 flex h-2 gap-[3px]"
      >
        {[
          { n: graduated, cls: "bar-fill" },
          { n: learned - graduated, cls: "bg-accent-line" },
          { n: fresh, cls: "bg-white" },
        ]
          .filter((seg) => seg.n > 0)
          .map((seg) => (
            <span key={seg.cls} className={`min-w-2 basis-0 rounded-full ${seg.cls}`} style={{ flexGrow: seg.n }} />
          ))}
      </div>
      <div className="mt-3 flex gap-4 text-[13px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
          장기 기억 {graduated}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-accent-line" aria-hidden="true" />
          기억하는 중 {learned - graduated}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-white" aria-hidden="true" />
          시작 전 {fresh}
        </span>
      </div>
    </section>
  );
}

function ManagedRow({ progress: p, today }: { progress: LessonProgress; today: string }) {
  const due = today !== "" && isDueToday(p, today);
  return (
    <Link href={`/lessons/${p.lesson.id}`} className="card flex min-h-[72px] items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold tracking-[-0.2px]">{p.lesson.title}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[13px] text-soft">
          <span className="shrink-0">{p.lesson.unit}</span>
          {p.sureWrong && <span className="size-1.5 shrink-0 rounded-full bg-wrong" aria-hidden="true" />}
          <span className={`truncate ${due ? "font-medium text-accent-ink" : ""}`}>
            {today === "" ? " " : nextCheckLabel(p, today)}
          </span>
        </div>
      </div>
      <RecordChip best={p.best} />
    </Link>
  );
}
