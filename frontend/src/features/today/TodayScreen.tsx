"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { PrimaryButton, TextButton } from "@/components/ui/buttons";
import { ArrowRightIcon } from "@/components/ui/icons";
import { api, type Home, type Rate } from "@/lib/api";
import {
  greeting,
  lessonsLearnedOn,
  recallPercent,
  roadmap,
  unitProgress,
  weekBars,
  withName,
  type Roadmap,
  type UnitProgress,
} from "@/lib/home";
import { lessonProgress } from "@/lib/lessonProgress";
import { WEEKDAYS, weekDates } from "@/lib/memory";
import { minutesFor } from "@/lib/schedule";
import { useCountUp } from "@/lib/useCountUp";
import { useClientValue, useRemote } from "@/lib/useRemote";
import { FirstRunSheet } from "./FirstRunSheet";

const FIRST_RUN_KEY = "retrievo.firstRunSeen";

const fetchToday = async () => {
  const [checks, home, lessons, concepts, me] = await Promise.all([
    api.todayChecks(),
    api.home(),
    api.lessons(),
    api.concepts(),
    api.me(),
  ]);
  return { checks, home, concepts, me, lessons: lessonProgress(lessons, concepts) };
};

type TodayData = Awaited<ReturnType<typeof fetchToday>>;

function todayLabel(): string {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
}

function currentHour(): number {
  return new Date().getHours();
}

function firstRunSeen(): boolean {
  try {
    return localStorage.getItem(FIRST_RUN_KEY) !== null;
  } catch {
    return true; // 저장소를 못 쓰면 안내를 띄우지 않는다
  }
}

/**
 * 오늘 (2026-11-28 다시 설계). 위에서 아래로 시간 범위가 넓어진다:
 * 인사 → 오늘 할 일 → 연속 학습 → 이번 주 → 최근 기억률 → 전체 로드맵 → 과정별 진행도.
 * 숫자를 늘어놓지 않고 그림으로 보여 준다. 계산은 lib/home.ts에 있다.
 */
export function TodayScreen() {
  const [state, retry] = useRemote(fetchToday);
  // 날짜, 시각, 첫 사용 여부는 브라우저에서만 알 수 있다
  const dateLabel = useClientValue(todayLabel, "");
  const hour = useClientValue<number | null>(currentHour, null);
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

  const data = state.status === "ready" ? state.data : null;
  const tasks = data ? todayTasks(data) : null;
  const hello =
    data && tasks && hour !== null
      ? withName(
          greeting({ hour, allDone: tasks.allDone, firstDay: data.home.learned === 0, streak: data.home.streak }),
          data.me.nickname,
        )
      : "";

  return (
    <main className="app-frame">
      <header className="px-6 pt-5 pb-1">
        <p className="h-[18px] text-[13px] text-muted">{dateLabel}</p>
        <h1 className="mt-1 min-h-[30px] text-[22px] leading-[30px] font-semibold tracking-[-0.5px]">{hello}</h1>
      </header>

      {state.status === "loading" && <Skeleton />}

      {state.status === "error" && (
        <div className="py-8 text-center text-[15px] text-muted">
          <p>오늘 화면을 불러오지 못했어요.</p>
          <p className="mt-1 text-[13px] text-faint">{state.message}</p>
          <button type="button" onClick={retry} className="mt-4 text-[15px] font-semibold text-accent-ink underline">
            다시 불러오기
          </button>
        </div>
      )}

      {data && tasks && (
        <>
          <Tasks tasks={tasks} onHelp={() => setSheetOpen(true)} />
          <Streak home={data.home} />
          <Week home={data.home} lessons={tasks.lessonsThisWeek} />
          <Recall rate={data.home.recall} />
          <RoadmapCard map={roadmap(data.lessons)} />
          <Units units={unitProgress(data.lessons)} />
        </>
      )}

      <div className="mt-auto pt-6" />
      <BottomNav active="오늘" />

      {showFirstRun && <FirstRunSheet title={sheetOpen ? "숫자의 뜻" : undefined} onClose={closeFirstRun} />}
    </main>
  );
}

interface TodayTasks {
  /** 오늘 복습할 개념: 끝낸 것과 남은 것 */
  reviewTotal: number;
  reviewLeft: number;
  /** 오늘 배움을 마친 레슨 수 */
  lessonsToday: number;
  lessonsThisWeek: number;
  /** 아직 배우지 않은 레슨이 남았는가 */
  hasNewLesson: boolean;
  allDone: boolean;
}

/** 오늘 할 일은 복습과 새 레슨 1개다. 어떤 레슨을 배울지는 사용자가 고른다 */
function todayTasks({ checks, home, concepts, lessons }: TodayData): TodayTasks {
  const lessonsToday = lessonsLearnedOn(concepts, new Set([home.today]));
  const hasNewLesson = lessons.some((p) => p.best === 0);
  const reviewLeft = checks.length;
  return {
    reviewTotal: home.checksTotal,
    reviewLeft,
    lessonsToday,
    lessonsThisWeek: lessonsLearnedOn(concepts, new Set(weekDates(home.today))),
    hasNewLesson,
    allDone: reviewLeft === 0 && (lessonsToday > 0 || !hasNewLesson),
  };
}

/** 오늘 할 일: 복습과 새 레슨. 끝낸 줄은 체크로 채워지고, 버튼은 남은 것 가운데 첫 번째로 간다 */
function Tasks({ tasks, onHelp }: { tasks: TodayTasks; onHelp: () => void }) {
  const { reviewTotal, reviewLeft, lessonsToday, hasNewLesson, allDone } = tasks;
  const reviewDone = reviewTotal - reviewLeft;
  const lessonDone = lessonsToday > 0;
  return (
    <section className="hero fade-up mx-4 mt-3 px-5 pt-4 pb-5" aria-labelledby="tasks-title">
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <h2 id="tasks-title">오늘 할 일</h2>
        <button
          type="button"
          onClick={onHelp}
          aria-label="숫자의 뜻"
          className="relative inline-flex size-5 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-accent-ink before:absolute before:-inset-2.5"
        >
          ?
        </button>
      </div>
      <ul className="mt-3 flex flex-col gap-3.5">
        {reviewTotal > 0 ? (
          <Task
            done={reviewLeft === 0}
            title={`복습 ${reviewTotal}개`}
            note={
              reviewLeft === 0
                ? "오늘 꺼낼 개념을 다 꺼냈어요"
                : reviewDone > 0
                  ? `${reviewDone}개 꺼냈어요. 남은 ${reviewLeft}개는 약 ${minutesFor(reviewLeft)}분`
                  : `전에 배운 개념을 다시 꺼내요. 약 ${minutesFor(reviewLeft)}분`
            }
          />
        ) : (
          <Task done title="복습 없음" note="오늘은 다시 확인할 개념이 없어요" />
        )}
        {(hasNewLesson || lessonDone) && (
          <Task
            done={lessonDone}
            title="새 레슨 1개"
            note={lessonDone ? `오늘 ${lessonsToday}개 배웠어요` : "배우고 싶은 레슨을 골라요"}
          />
        )}
      </ul>
      {reviewLeft > 0 ? (
        <PrimaryButton href="/check" className="mt-5">
          {reviewDone > 0 ? "복습 이어 하기" : "복습 시작하기"}
          <ArrowRightIcon />
        </PrimaryButton>
      ) : !allDone ? (
        <PrimaryButton href="/lessons" className="mt-5">
          새 레슨 고르기
          <ArrowRightIcon />
        </PrimaryButton>
      ) : (
        hasNewLesson && (
          <TextButton href="/lessons" className="mt-2 -mb-2 text-accent-ink">
            레슨 더 배우기
          </TextButton>
        )
      )}
    </section>
  );
}

function Task({ done, title, note }: { done: boolean; title: string; note: string }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
          done ? "pop bg-accent text-white" : "border-[1.5px] border-accent bg-white"
        }`}
        aria-hidden="true"
      >
        {done && <Check size={13} />}
      </span>
      <div className="min-w-0">
        <div className="text-[17px] leading-snug font-semibold tracking-[-0.3px]">
          {title}
          <span className="sr-only">{done ? " (끝냄)" : " (남음)"}</span>
        </div>
        <div className="mt-0.5 text-[13px] text-muted">{note}</div>
      </div>
    </li>
  );
}

function Check({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/** 연속 학습 일수와 이번 주. 답을 낸 날은 채워지고, 오늘은 테두리로 표시한다 */
function Streak({ home }: { home: Home }) {
  const week = weekDates(home.today);
  const active = new Set(home.activeDates);
  const streak = useCountUp(home.streak);
  return (
    <section className="card fade-up mx-4 mt-3 px-5 py-4" style={{ animationDelay: "50ms" }} aria-label={`연속 학습 ${home.streak}일`}>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[28px] leading-none font-semibold tracking-[-1px] tabular-nums">{streak}</span>
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
                {on && <Check size={16} />}
              </span>
              <span className={`text-[11px] ${isToday ? "font-semibold text-accent-ink" : "text-soft"}`}>{WEEKDAYS[i]}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** 이번 주 학습량: 배운 레슨 수, 푼 문제 수, 요일별로 푼 문제 */
function Week({ home, lessons }: { home: Home; lessons: number }) {
  const bars = weekBars(home.today, home.weekSolved);
  const solved = bars.reduce((sum, b) => sum + b.count, 0);
  const lessonCount = useCountUp(lessons);
  const solvedCount = useCountUp(solved);
  return (
    <section
      className="card fade-up mx-4 mt-2 px-5 py-4"
      style={{ animationDelay: "100ms" }}
      aria-label={`이번 주에 레슨 ${lessons}개를 배우고 문제 ${solved}개를 풀었어요`}
    >
      <h2 className="text-[13px] text-muted">이번 주</h2>
      <div className="mt-1.5 flex items-end gap-5" aria-hidden="true">
        <div className="shrink-0 pb-[21px]">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[28px] leading-none font-semibold tracking-[-1px] tabular-nums">{lessonCount}</span>
            <span className="text-[15px] font-medium text-sub">레슨</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[28px] leading-none font-semibold tracking-[-1px] tabular-nums">{solvedCount}</span>
            <span className="text-[15px] font-medium text-sub">문제</span>
          </div>
        </div>
        <ol className="grid min-w-0 flex-1 grid-cols-7 gap-1.5">
          {bars.map((b, i) => (
            <li key={b.date} className="flex flex-col items-center gap-1.5" title={b.future ? undefined : `${b.count}문제`}>
              <span className="flex h-[60px] w-full items-end">
                <span
                  className={`grow-y w-full rounded-md ${b.count > 0 ? "bar-fill" : "bg-line"}`}
                  style={{ height: b.count > 0 ? `${Math.max(b.ratio * 100, 10)}%` : 4, animationDelay: `${150 + i * 40}ms` }}
                />
              </span>
              <span className={`text-[11px] ${b.isToday ? "font-semibold text-accent-ink" : "text-soft"}`}>{WEEKDAYS[i]}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const RING_R = 34;
const RING_LENGTH = 2 * Math.PI * RING_R;

/** 최근 기억률: 최근 30일 동안 다시 물었을 때 기억한 비율. 내려갈 수 있지만 복습하면 회복된다 */
function Recall({ rate }: { rate: Rate }) {
  const percent = recallPercent(rate);
  const shown = useCountUp(percent ?? 0, 900);
  return (
    <section className="card fade-up mx-4 mt-2 flex items-center gap-4 px-5 py-4" style={{ animationDelay: "150ms" }} aria-labelledby="recall-title">
      <svg width="84" height="84" viewBox="0 0 84 84" className="shrink-0" aria-hidden="true">
        <circle cx="42" cy="42" r={RING_R} fill="none" stroke="var(--color-line)" strokeWidth="9" />
        {percent !== null && percent > 0 && (
          <circle
            className="ring-draw"
            cx="42"
            cy="42"
            r={RING_R}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - percent / 100)}
            transform="rotate(-90 42 42)"
            style={{ "--ring-length": RING_LENGTH } as React.CSSProperties}
          />
        )}
        <text x="42" y="49" textAnchor="middle" fontSize="20" fontWeight="600" fill="var(--color-ink)" className="tabular-nums">
          {percent === null ? "" : `${shown}%`}
        </text>
      </svg>
      <div className="min-w-0">
        <h2 id="recall-title" className="text-[15px] font-semibold tracking-[-0.2px]">
          최근 기억률{percent !== null && <span className="sr-only"> {percent}%</span>}
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {percent !== null ? (
            <>
              최근 30일 동안 다시 물은 {rate.total}번 가운데 <b className="font-semibold text-ink">{rate.correct}번</b> 기억했어요.
            </>
          ) : rate.total > 0 ? (
            `지금까지 ${rate.total}번 다시 물었어요. 5번이 쌓이면 기억률을 보여 드려요.`
          ) : (
            "배운 개념은 3일 뒤부터 다시 물어요. 그때부터 얼마나 기억하는지 보여 드려요."
          )}
        </p>
      </div>
    </section>
  );
}

/** 막대에서 차지하는 너비(%). 0이 아니면 보일 만큼은 준다 */
function share(n: number, total: number): number {
  if (n === 0 || total === 0) return 0;
  return Math.max((n / total) * 100, 2);
}

/** 전체 로드맵: 레슨 전체 가운데 어디까지 왔는지. 진한 색은 장기 기억, 연한 색은 배운 레슨 */
function RoadmapCard({ map }: { map: Roadmap }) {
  const learning = map.learned - map.longTerm;
  return (
    <Link
      href="/lessons"
      className="card fade-up mx-4 mt-2 block px-5 py-4"
      style={{ animationDelay: "200ms" }}
      aria-label={`백엔드 로드맵. 레슨 ${map.total}개 가운데 ${map.learned}개를 배웠고 ${map.longTerm}개는 장기 기억이 됐어요`}
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold tracking-[-0.2px]">백엔드 로드맵</h2>
        <span className="text-[13px] text-muted">
          <b className="font-semibold text-ink">{map.learned}</b> / {map.total} 레슨
        </span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="grow-x flex h-full" style={{ animationDelay: "250ms" }}>
          <span className="bg-accent-ink" style={{ width: `${share(map.longTerm, map.total)}%` }} />
          <span className="bg-memory-2" style={{ width: `${share(learning, map.total)}%` }} />
        </div>
      </div>
      <div className="mt-2.5 flex gap-4 text-[12px] text-muted" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-[2px] bg-accent-ink" />
          장기 기억 {map.longTerm}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-[2px] bg-memory-2" />
          배움 {learning}
        </span>
      </div>
    </Link>
  );
}

/** 과정별 진행도: 어떤 주제를 많이 배웠는지 */
function Units({ units }: { units: UnitProgress[] }) {
  return (
    <section className="card fade-up mx-4 mt-2 px-5 py-4" style={{ animationDelay: "250ms" }} aria-labelledby="units-title">
      <h2 id="units-title" className="text-[15px] font-semibold tracking-[-0.2px]">
        과정별 진행도
      </h2>
      <ul className="mt-3 flex flex-col gap-2.5">
        {units.map((u, i) => (
          <li key={u.unit} className="grid grid-cols-[minmax(0,104px)_1fr_44px] items-center gap-3">
            <span className="text-[13px] leading-snug text-muted">{u.unit}</span>
            <span className="h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
              <span
                className="grow-x bar-fill block h-full rounded-full"
                style={{ width: `${share(u.learned, u.total)}%`, animationDelay: `${300 + i * 40}ms` }}
              />
            </span>
            <span className="text-right text-[13px] text-muted tabular-nums">
              <b className="font-semibold text-ink">{u.learned}</b>/{u.total}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <div className="hero mx-4 mt-3 h-[212px]" />
      <div className="card mx-4 mt-3 h-[124px]" />
      <div className="card mx-4 mt-2 h-[128px]" />
      <div className="card mx-4 mt-2 h-[116px]" />
    </div>
  );
}
