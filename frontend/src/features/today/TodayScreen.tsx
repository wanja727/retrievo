"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { PrimaryButton } from "@/components/ui/buttons";
import { ArrowRightIcon } from "@/components/ui/icons";
import { api, type Home } from "@/lib/api";
import { lessonProgress, type LessonProgress } from "@/lib/lessonProgress";
import { WEEKDAYS, recordLabel, weekDates } from "@/lib/memory";
import { checkReason, minutesFor } from "@/lib/schedule";
import { useClientValue, useRemote } from "@/lib/useRemote";
import { FirstRunSheet } from "./FirstRunSheet";

const FIRST_RUN_KEY = "retrievo.firstRunSeen";

const fetchToday = async () => {
  const [checks, home, lessons, concepts] = await Promise.all([
    api.todayChecks(),
    api.home(),
    api.lessons(),
    api.concepts(),
  ]);
  return { checks, home, lessons: lessonProgress(lessons, concepts) };
};

function todayLabel(): string {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
}

function firstRunSeen(): boolean {
  try {
    return localStorage.getItem(FIRST_RUN_KEY) !== null;
  } catch {
    return true; // 저장소를 못 쓰면 안내를 띄우지 않는다
  }
}

/**
 * 오늘. 이 화면에는 쌓이기만 하는 값만 둔다: 오늘 꺼낸 수, 연속 학습, 기억 지도(레슨마다 얼마나 오래 기억했는지), 꺼낸 횟수.
 * 내려갈 수 있는 비율(정답률 같은 것)은 기록 화면에서만 보여준다.
 */
export function TodayScreen() {
  const [state, retry] = useRemote(fetchToday);
  // 날짜와 첫 사용 여부는 브라우저에서만 알 수 있다
  const dateLabel = useClientValue(todayLabel, "");
  const seen = useClientValue(firstRunSeen, true);
  const [sheetOpen, setSheetOpen] = useState<boolean | null>(null);
  const showFirstRun = sheetOpen ?? !seen;

  const closeFirstRun = () => {
    setSheetOpen(false);
    try {
      localStorage.setItem(FIRST_RUN_KEY, "1");
    } catch {
      // 저장하지 못하면 다음에 한 번 더 보일 뿐이다
    }
  };

  const checks = state.status === "ready" ? state.data.checks : [];
  const home = state.status === "ready" ? state.data.home : null;
  const done = home?.checksDone ?? 0;
  const total = home?.checksTotal ?? 0;
  const left = checks.length;

  return (
    <main className="app-frame">
      <header className="flex h-14 shrink-0 items-center gap-2 px-6">
        <span
          className="flex size-6 items-center justify-center rounded-lg bg-accent text-[13px] font-bold text-white"
          aria-hidden="true"
        >
          R
        </span>
        <div className="text-[17px] font-semibold tracking-[-0.4px]">Retrievo</div>
      </header>

      <section className="hero mx-4 mt-1 px-6 pt-5 pb-6" aria-labelledby="today-title">
        <div className="flex h-5 items-center justify-between text-[13px] text-muted">
          <h1 id="today-title">오늘 꺼낸 개념</h1>
          <span>{dateLabel}</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-[72px] leading-none font-semibold tracking-[-4px]">{done}</span>
          <span className="text-[22px] font-medium text-soft">/ {total}</span>
          {left > 0 && <span className="ml-auto text-[13px] text-muted">약 {minutesFor(left)}분</span>}
        </div>
        {total > 0 && (
          <div
            role="img"
            aria-label={`오늘 ${total}개 중 ${done}개 꺼냄`}
            className="mt-4 grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={`h-2 rounded-full ${i < done ? "bar-fill" : "bg-white"}`} />
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 text-[13px] text-muted">
          {home === null
            ? " "
            : total === 0
              ? "오늘은 다시 확인할 개념이 없어요"
              : left === 0
                ? "오늘 꺼낼 개념을 다 꺼냈어요"
                : "다시 확인할 때가 된 개념이에요"}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="숫자의 뜻"
            className="inline-flex size-5 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-accent-ink"
          >
            ?
          </button>
        </div>
        {left > 0 && (
          <PrimaryButton href="/check" className="mt-5">
            {left}개 꺼내기
            <ArrowRightIcon />
          </PrimaryButton>
        )}
        {home !== null && left === 0 && (
          <PrimaryButton href="/lessons" className="mt-5">
            새 레슨 배우기
            <ArrowRightIcon />
          </PrimaryButton>
        )}
      </section>

      {state.status === "error" && (
        <div className="py-8 text-center text-[15px] text-muted">
          <p>오늘 꺼낼 개념을 불러오지 못했어요.</p>
          <p className="mt-1 text-[13px] text-faint">{state.message}</p>
          <button type="button" onClick={retry} className="mt-4 text-[15px] font-semibold text-accent-ink underline">
            다시 불러오기
          </button>
        </div>
      )}

      {home && <Streak home={home} />}
      {state.status === "ready" && <MemoryMap lessons={state.data.lessons} retrievals={state.data.home.retrievals} />}

      {(state.status === "loading" || left > 0) && (
        <section className="mx-4 mt-6 flex flex-col gap-2" aria-labelledby="checks-title">
          <h2 id="checks-title" className="px-2 pb-0.5 text-[13px] font-semibold text-sub">
            남은 개념 {state.status === "ready" ? left : ""}
          </h2>
          {state.status === "loading" && <ListSkeleton />}
          {checks.map((check) => (
            <Link key={check.conceptId} href="/check" className="card flex min-h-[72px] items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold tracking-[-0.2px]">{check.conceptName}</div>
                <div className="mt-[3px] flex items-center gap-1.5 text-[13px] text-soft">
                  <span className="truncate">{checkReason(check)}</span>
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}

      <div className="mt-auto pt-6" />
      <BottomNav active="오늘" />

      {showFirstRun && <FirstRunSheet title={sheetOpen ? "숫자의 뜻" : undefined} onClose={closeFirstRun} />}
    </main>
  );
}

/** 연속 학습 일수와 이번 주. 답을 낸 날은 채워지고, 오늘은 테두리로 표시한다 */
function Streak({ home }: { home: Home }) {
  const week = weekDates(home.today);
  const active = new Set(home.activeDates);
  return (
    <section className="card mx-4 mt-3 px-5 py-4" aria-label={`연속 학습 ${home.streak}일`}>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[28px] leading-none font-semibold tracking-[-1px]">{home.streak}</span>
        <span className="text-[15px] font-medium text-sub">일 연속 학습</span>
      </div>
      <ol className="mt-3.5 grid grid-cols-7 gap-1.5" aria-hidden="true">
        {week.map((date, i) => {
          const on = active.has(date);
          const isToday = date === home.today;
          return (
            <li key={date} className="flex flex-col items-center gap-1.5">
              <span
                className={`flex size-8 items-center justify-center rounded-full ${
                  on ? "bg-accent text-white" : isToday ? "border-[1.5px] border-accent" : "bg-surface"
                }`}
              >
                {on && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
              </span>
              <span className={`text-[11px] ${isToday ? "font-semibold text-accent-ink" : "text-soft"}`}>{WEEKDAYS[i]}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** 기억이 오래 갈수록 진해지는 색. 시작 전 → 학습 완료 → 3일 → 7일 → 장기 기억 */
const MAP_SHADES = ["bg-surface", "bg-[#ddd7fb]", "bg-[#b9aff6]", "bg-accent", "bg-accent-ink"];

/**
 * 기억 지도: 한 칸이 레슨 하나이고, 더 오래 기억할수록 칸이 진해진다.
 * 숫자 세 개를 나란히 두는 것보다 한눈에 들어오고, 칸은 진해지기만 해서 쓸수록 채워지는 것이 보인다.
 */
function MemoryMap({ lessons, retrievals }: { lessons: LessonProgress[]; retrievals: number }) {
  const learned = lessons.filter((p) => p.best >= 1).length;
  const longTerm = lessons.filter((p) => p.best >= 4).length;
  return (
    <Link href="/lessons" className="card mx-4 mt-2 block px-5 py-4" aria-label={`기억 지도. 레슨 ${lessons.length}개 가운데 ${learned}개 학습, ${longTerm}개 장기 기억`}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold tracking-[-0.2px]">기억 지도</h2>
        <span className="text-[13px] text-soft">{retrievals.toLocaleString("ko-KR")}번 꺼냄</span>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        레슨 {lessons.length}개 가운데 <b className="font-semibold text-ink">{learned}개</b>를 배웠고{" "}
        <b className="font-semibold text-ink">{longTerm}개</b>는 장기 기억이 됐어요.
      </p>
      <div className="mt-3.5 grid grid-cols-[repeat(auto-fill,minmax(30px,1fr))] gap-1.5" aria-hidden="true">
        {lessons.map((p) => (
          <span
            key={p.lesson.id}
            title={`${p.lesson.title}: ${p.best === 0 ? "시작 전" : recordLabel(p.best)}`}
            className={`aspect-square rounded-lg ${MAP_SHADES[Math.min(p.best, 4)]}`}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-soft" aria-hidden="true">
        시작 전
        {MAP_SHADES.map((s) => (
          <span key={s} className={`size-2.5 rounded-[3px] ${s}`} />
        ))}
        장기 기억
      </div>
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="불러오는 중" className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card flex h-[72px] items-center gap-3.5 px-4">
          <div className="flex-1">
            <div className="h-4 w-40 rounded bg-surface" />
            <div className="mt-2 h-3 w-28 rounded bg-surface" />
          </div>
          <div className="h-6 w-14 rounded-full bg-surface" />
        </div>
      ))}
    </div>
  );
}
