"use client";

import { BottomNav } from "@/components/ui/BottomNav";
import { LoadError } from "@/components/ui/LoadError";
import { api, type Home, type Report } from "@/lib/api";
import { activityGrid, activityLevel, percent } from "@/lib/report";
import { useRemote } from "@/lib/useRemote";

const fetchReport = async () => {
  const [report, home] = await Promise.all([api.report(), api.home()]);
  return { report, home };
};

/**
 * 기록 (20장). 인출이 실제로 남았는지를 숫자로 보여준다.
 * 모두 실제 풀이·확인 기록에서 센 값이고, 표본이 없으면 숫자 대신 아직 없다고 말한다 (1장 "숫자는 측정한 것만").
 */
export function ReportScreen() {
  const [state, retry] = useRemote(fetchReport);

  if (state.status === "error") {
    return <LoadError what="기록을" message={state.message} onRetry={retry} />;
  }

  return (
    <main className="app-frame">
      <header className="flex h-14 shrink-0 items-center px-6">
        <h1 className="text-[17px] font-semibold tracking-[-0.3px]">기록</h1>
      </header>
      {state.status === "loading" ? (
        <div className="mx-4 mt-1" aria-busy="true" aria-label="불러오는 중">
          <div className="hero h-52" />
          <div className="card mt-4 h-48" />
        </div>
      ) : (
        <ReportBody report={state.data.report} home={state.data.home} />
      )}
      <div className="mt-auto" />
      <BottomNav active="기록" />
    </main>
  );
}

function ReportBody({ report, home }: { report: Report; home: Home }) {
  return (
    <div className="pb-8">
      <Hero home={home} />
      <CurveSection report={report} />
      <ActivitySection report={report} />
      <StageSection report={report} />
    </div>
  );
}

function SectionTitle({ id, children, right }: { id: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 id={id} className="text-[15px] font-semibold tracking-[-0.2px]">
        {children}
      </h2>
      {right && <span className="text-[13px] text-soft">{right}</span>}
    </div>
  );
}

/** 맨 위: 지금까지 꺼낸 횟수. 쌓이기만 하는 값을 먼저 보여주고, 정답률 같은 비율은 아래 칸에 둔다 */
function Hero({ home }: { home: Home }) {
  return (
    <section className="hero mx-4 mt-1 px-6 pt-5 pb-5" aria-labelledby="hero-title">
      <h2 id="hero-title" className="text-[13px] text-muted">
        지금까지 꺼낸 횟수
      </h2>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[72px] leading-none font-semibold tracking-[-4px]">
          {home.retrievals.toLocaleString("ko-KR")}
        </span>
        <span className="text-[22px] font-medium text-soft">번</span>
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-2">
        <Stat label="연속 학습 일수" value={home.streak} />
        <Stat label="배운 개념" value={home.learned} />
        <Stat label="장기 기억 개념" value={home.longTerm} />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/55 px-3 py-3">
      <dd className="text-[22px] font-semibold tracking-[-0.5px]">{value.toLocaleString("ko-KR")}</dd>
      <dt className="mt-0.5 text-[11px] text-muted">{label}</dt>
    </div>
  );
}

const CURVE_LABELS = ["배운 날", "3일", "7일", "21일"] as const;

/**
 * 내 기억 곡선: 배운 날과 3·7·21일 재확인의 정답률.
 * 시안에 있던 "복습 없을 때 예상" 선은 측정한 값이 아니라서 넣지 않았다.
 */
function CurveSection({ report }: { report: Report }) {
  const { learnedDay, day3, day7, day21 } = report.curve;
  const rates = [learnedDay, day3, day7, day21];
  const values = rates.map(percent);
  const known = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  const W = 342;
  const H = 140;
  const xs = [8, 117, 225, 334];
  const y = (v: number) => +(130 - v * 1.2).toFixed(1);
  const last = known.at(-1);

  return (
    <section className="card mx-4 mt-4 px-5 py-5" aria-labelledby="curve-title">
      <SectionTitle id="curve-title">내 기억 곡선</SectionTitle>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        {last && last.i > 0 ? (
          <>
            배운 지 {CURVE_LABELS[last.i]} 뒤 확인에서 <b className="font-semibold text-ink">{last.v}%</b>를 꺼냈어요.
          </>
        ) : (
          "재확인을 하면 날짜별로 얼마나 남았는지 이어서 보여요."
        )}
      </p>
      {known.length > 0 && (
        <svg
          role="img"
          aria-label={`정답률: ${CURVE_LABELS.map((l, i) => `${l} ${values[i] ?? "기록 없음"}${values[i] === null ? "" : "%"}`).join(", ")}`}
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          className="mt-4 block"
        >
          <line x1="0" y1="10" x2={W} y2="10" stroke="var(--color-line)" />
          <line x1="0" y1="70" x2={W} y2="70" stroke="var(--color-line)" />
          <line x1="0" y1="130" x2={W} y2="130" stroke="var(--color-line-strong)" />
          {known.length > 1 && (
            <polyline
              points={known.map((p) => `${xs[p.i]},${y(p.v)}`).join(" ")}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="1.8"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {known.map((p) => (
            <g key={p.i}>
              <circle
                cx={xs[p.i]}
                cy={y(p.v)}
                r={p === last ? 4 : 2.5}
                fill={p === last ? "var(--color-accent)" : "#FFFFFF"}
                stroke="var(--color-accent)"
                strokeWidth="1.4"
              />
              <text
                x={xs[p.i]}
                y={y(p.v) - 9}
                textAnchor={p.i === 0 ? "start" : p.i === 3 ? "end" : "middle"}
                fontSize="11"
                fontWeight={p === last ? 600 : 400}
                fill={p === last ? "var(--color-accent-ink)" : "var(--color-soft)"}
              >
                {p.v}%
              </text>
            </g>
          ))}
        </svg>
      )}
      <div className="mt-1.5 grid grid-cols-4 text-[11px] text-soft">
        {CURVE_LABELS.map((label, i) => (
          <div key={label} className={i === 0 ? "" : i === 3 ? "text-right" : "text-center"}>
            <div className="font-medium text-muted">{label}</div>
            <div>{rates[i].total > 0 ? `${rates[i].total}번` : "아직 없음"}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

const SHADES = ["bg-[#f1eff8]", "bg-[#ddd7fb]", "bg-[#b9aff6]", "bg-accent", "bg-accent-ink"];

/** 꺼낸 날: 최근 26주 동안 답을 낸 날. 진할수록 그날 많이 꺼냈다 */
function ActivitySection({ report }: { report: Report }) {
  const grid = activityGrid(report.today, report.activity);
  const days = report.activity.length;
  const month = (date: string) => `${Number(date.slice(5, 7))}월`;
  return (
    <section className="card mx-4 mt-4 px-5 py-5" aria-labelledby="activity-title">
      <SectionTitle id="activity-title" right={`최근 26주 동안 ${days}일`}>
        꺼낸 날
      </SectionTitle>
      <div
        role="img"
        aria-label={`최근 26주 동안 ${days}일 꺼냄`}
        className="mt-3.5 grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${grid.length}, minmax(0, 1fr))` }}
      >
        {grid.map((column, w) => (
          <div key={w} className="grid gap-[3px]">
            {column.map((cell) => (
              <span
                key={cell.date}
                title={cell.future ? undefined : `${cell.date}, ${cell.count}번`}
                className={`aspect-square rounded-[2px] ${cell.future ? "" : SHADES[activityLevel(cell.count)]}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-soft">
        <span>{month(grid[0][0].date)}</span>
        <span className="flex items-center gap-1">
          적게
          {SHADES.map((s) => (
            <span key={s} className={`size-2 rounded-[2px] ${s}`} />
          ))}
          많이
        </span>
        <span>{month(report.today)}</span>
      </div>
    </section>
  );
}

/** 개념이 어디까지 왔는지: 단계별 개념 수. 졸업만 진하게 */
function StageSection({ report }: { report: Report }) {
  const { learning, passed1, passed2, passed3, graduated } = report.stages;
  const rows = [
    { label: "배우는 중", n: learning },
    { label: "배운 날 통과", n: passed1 },
    { label: "3일 뒤 통과", n: passed2 },
    { label: "7일 뒤 통과", n: passed3 },
    { label: "장기 기억", n: graduated, last: true },
  ];
  const learned = passed1 + passed2 + passed3 + graduated;
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <section className="card mx-4 mt-4 px-5 py-5" aria-labelledby="stage-title">
      <SectionTitle id="stage-title">개념이 어디까지 왔는지</SectionTitle>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        {learned === 0 ? (
          "레슨 문제를 같은 날 모두 맞힌 개념부터 여기에 쌓여요."
        ) : (
          <>
            배운 개념 {learned}개 가운데 <b className="font-semibold text-ink">{graduated}개</b>가 장기 기억이 돼서 더는 묻지 않아요.
          </>
        )}
      </p>
      <div className="mt-4 flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[112px_1fr_28px] items-center gap-3">
            <span className={`text-[13px] ${r.last ? "font-semibold text-accent-ink" : "text-muted"}`}>{r.label}</span>
            <div className="h-2 rounded-full bg-line">
              <div
                className={`h-full rounded-full ${r.last ? "bar-fill" : "bg-accent-line"}`}
                style={{ width: `${(r.n / max) * 100}%` }}
              />
            </div>
            <span className="text-right text-[13px] font-semibold">{r.n}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
