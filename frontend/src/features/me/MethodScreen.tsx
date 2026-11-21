import Link from "next/link";

/**
 * 관리 원칙 (시안 Method): 무엇을 언제 다시 묻는지와 그 근거 8가지.
 * 근거 논문은 초록과 2차 요약으로 확인했다 (설계 문서 20장, 2026-11-20 메타분석 위주로 갱신, ADR-022). 화면에도 그렇게 밝힌다.
 */
const PRINCIPLES = [
  {
    title: "배우기 전에 먼저 꺼내기",
    text: "레슨을 시작하기 전에 예측부터 하게 해요. 틀려도 그 뒤 학습이 더 잘 남아요.",
    source: "St. Hilaire, Chan & Ahn, 2023 (메타분석); Richland 외, 2009",
  },
  {
    title: "보지 않고 내 말로 설명하기",
    text: "서술형은 자료를 보지 않고 내 말로 설명하게 해요. 말해도 되고 적어도 돼요.",
    source: "Bisra 외, 2018 (메타분석); Karpicke & Blunt, 2011",
  },
  {
    title: "답을 고른 뒤에만 해설",
    text: "정답과 해설은 답과 확신도를 낸 뒤에만 열려요. 훑어보지 않고 스스로 고르는 것 자체가 꺼내기예요.",
    source: "Yang 외, 2021 (메타분석); Smith & Karpicke, 2014",
  },
  {
    title: "배운 날 맞힐 때까지, 그 뒤 3번",
    text: "배운 날 틀린 문제는 다른 문제를 푼 뒤 다시 물어 모두 맞힐 때까지 이어 가요. 그 뒤 넓은 간격으로 세 번 더 확인하고, 확인에서 틀리면 그날 다른 문제로 다시 배워요.",
    source: "Rawson & Dunlosky, 2011; 2022 (리뷰)",
  },
  {
    title: "간격은 넓게",
    text: "간격을 점점 늘리든 일정하게 두든 차이가 없고, 총 간격이 중요해요. 3일, 7일, 21일 뒤에 물어요.",
    source: "Latimier, Peyre & Ramus, 2021 (메타분석); Cepeda 외, 2008",
  },
  {
    title: "섞어서, 매번 다른 문제로",
    text: "여러 개념을 섞어 내고, 재확인은 처음과 다른 문제로 해요. 같은 답을 외운 게 아니라 개념을 아는지 봐요.",
    source: "Brunmair & Richter, 2019 (메타분석); Pan & Rickard, 2018 (메타분석)",
  },
  {
    title: "틀린 확신은 다음 날, 애매한 정답엔 해설",
    text: "확실했는데 틀리면 다음 날 먼저 묻고, 애매하게 맞히면 해설을 꼭 보여 줘요.",
    source: "Metcalfe, 2017 (리뷰); Butler 외, 2008",
  },
  {
    title: "마지막에는 가르치듯 설명",
    text: "마지막 확인을 통과하면 동료에게 설명하듯 말로 풀어 보게 해요.",
    source: "Kobayashi, 2024 (메타분석); Koh, Lee & Lim, 2018",
  },
];

const TIMELINE = ["배운 날", "3일", "7일", "21일", "장기 기억"];

export function MethodScreen() {
  return (
    <main className="app-frame">
      <header className="flex h-14 shrink-0 items-center px-3">
        <Link href="/me" aria-label="뒤로" className="flex size-11 items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M11 6l-6 6 6 6" />
          </svg>
        </Link>
      </header>

      <section className="px-6 pt-4">
        <h1 className="text-[28px] leading-[1.3] font-semibold tracking-[-0.8px]">
          Retrievo가 기억을
          <br />
          관리하는 방법
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          편하게 읽는 대신 힘들여 꺼내게 해요. 근거는 여덟 가지예요.
        </p>
      </section>

      <div
        role="img"
        aria-label="확인 간격: 배운 날, 3일, 7일, 21일 뒤, 그리고 장기 기억"
        className="relative mx-6 mt-9 pb-7"
      >
        <div className="absolute top-[5px] right-[6px] left-[6px] h-px bg-line-strong" />
        <div className="relative flex justify-between">
          {TIMELINE.map((label, i) => {
            const last = i === TIMELINE.length - 1;
            return (
              <div key={label} className="relative flex w-3 flex-col items-center">
                <span
                  className={`size-3 rounded-full border-2 ${last ? "border-accent bg-accent" : "border-accent-line bg-white"}`}
                />
                <span
                  className={`absolute top-5 text-[13px] whitespace-nowrap ${last ? "font-semibold text-ink" : "text-muted"} ${
                    i === 0 ? "left-0" : last ? "right-0" : "left-1/2 -translate-x-1/2"
                  }`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <ol className="mx-4 mt-6 flex flex-col gap-2">
        {PRINCIPLES.map((p, i) => (
          <li key={p.title} className="card flex gap-3.5 px-4 py-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-ink">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-semibold tracking-[-0.2px]">{p.title}</h2>
              <p className="mt-1 text-[15px] leading-relaxed text-sub">{p.text}</p>
              <div className="mt-2 text-[13px] text-soft">{p.source}</div>
            </div>
          </li>
        ))}
      </ol>

      <p className="mx-6 mt-5 mb-10 text-[13px] leading-relaxed text-soft">
        근거는 2026년 11월에 메타분석과 리뷰 위주로 다시 확인했어요. 논문은 초록과 2차 요약으로 확인했고 원문 전체는 읽지
        않았어요. 실험 대부분은 단어·문장 같은 짧은 학습 자료라, 개발 개념처럼 복잡한 내용에서는 효과가 작을 수 있어요.
        3일·7일·21일이라는 날짜는 Retrievo가 정한 값이고, 논문이 뒷받침하는 것은 재확인 횟수와 넓은 간격까지예요.
      </p>
    </main>
  );
}
