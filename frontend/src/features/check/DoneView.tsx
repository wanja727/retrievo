import { BottomActions, PrimaryButton } from "@/components/ui/buttons";
import { api } from "@/lib/api";
import { recordLabel } from "@/lib/memory";
import { useRemote } from "@/lib/useRemote";

/** 오늘 확인으로 늘어난 기억 기록 */
export interface RecordGain {
  conceptName: string;
  before: number;
  after: number;
}

const fetchHome = () => api.home();

/** 오늘 꺼낼 것을 다 꺼낸 뒤. 맞힌 수와 함께, 오늘 쌓인 것(연속 학습, 늘어난 기억 기록, 꺼낸 횟수)을 보여준다 */
export function DoneView({
  total,
  correct,
  relearned = 0,
  gains = [],
}: {
  total: number;
  correct: number;
  relearned?: number;
  gains?: RecordGain[];
}) {
  // 제출할 때 서버가 값을 바꿨으니 다시 불러온다
  const [load] = useRemote(fetchHome);
  const home = load.status === "ready" ? load.data : null;

  if (total === 0) {
    return (
      <main className="app-frame celebrate">
        <div className="px-6 pt-24">
          <h1 className="text-[22px] leading-snug font-semibold tracking-[-0.6px]">오늘 꺼낼 개념이 없어요</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">새 레슨을 배우면 3일 뒤부터 다시 물어요.</p>
        </div>
        <BottomActions>
          <PrimaryButton href="/">오늘로 돌아가기</PrimaryButton>
        </BottomActions>
      </main>
    );
  }

  return (
    <main className="app-frame celebrate">
      <div className="fade-up px-6 pt-16 pb-6">
        <div className="text-[13px] text-muted">오늘 꺼낸 개념</div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-[88px] leading-[0.95] font-semibold tracking-[-5px]">{total}</span>
          <span className="text-[17px] text-soft">개, {correct}개 맞힘</span>
        </div>
        <div className="mt-6 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className="bar-fill h-2 rounded-full" />
          ))}
        </div>

        <dl className="card mt-8 grid min-h-[76px] grid-cols-2 divide-x divide-line py-4">
          {home && (
            <>
              <div className="px-4">
                <dd className="text-[22px] font-semibold tracking-[-0.5px]">
                  {home.streak}
                  <span className="ml-0.5 text-[15px] font-medium text-soft">일</span>
                </dd>
                <dt className="mt-0.5 text-[11px] text-muted">연속 학습</dt>
              </div>
              <div className="px-4">
                <dd className="text-[22px] font-semibold tracking-[-0.5px]">{home.retrievals.toLocaleString("ko-KR")}</dd>
                <dt className="mt-0.5 text-[11px] text-muted">꺼낸 횟수</dt>
              </div>
            </>
          )}
        </dl>

        {gains.length > 0 && (
          <section className="mt-2 rounded-[20px] bg-accent-soft px-4 pt-4 pb-1.5" aria-labelledby="gains-title">
            <h2 id="gains-title" className="text-[13px] text-muted">
              기억이 더 오래 가요
            </h2>
            <ul className="mt-1">
              {gains.map((g) => (
                <li key={g.conceptName} className="flex min-h-11 items-center gap-3 text-[15px]">
                  <span className="min-w-0 flex-1 truncate text-sub">{g.conceptName}</span>
                  <span className="shrink-0 font-semibold text-accent-ink">{recordLabel(g.after)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {relearned > 0 && (
          <p className="mt-6 text-[15px] leading-relaxed text-ink">
            틀린 개념 {relearned}개는 다른 문제로 다시 배웠어요.
          </p>
        )}
        <p className={`${relearned > 0 ? "mt-2" : "mt-6"} text-[15px] leading-relaxed text-muted`}>
          맞힌 개념은 더 긴 간격 뒤에 다시 물어요. 틀린 개념은 조금 더 빨리 다시 물어요.
        </p>
      </div>
      <BottomActions>
        <PrimaryButton href="/">오늘로 돌아가기</PrimaryButton>
      </BottomActions>
    </main>
  );
}
