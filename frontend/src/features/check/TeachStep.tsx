"use client";

import { useState } from "react";
import { BottomActions, PrimaryButton } from "@/components/ui/buttons";
import { SessionTopBar } from "@/components/ui/SessionTopBar";
import type { TeachPrompt } from "@/lib/api";
import { SpokenInput } from "@/components/ui/SpokenInput";

/**
 * 졸업 확인: 마지막 확인을 맞힌 뒤 신입 동료에게 가르치듯 말해 본다 (20장, Koh, Lee & Lim 2018).
 * 졸업은 이미 판정 문제로 정해졌다(ADR-007). 여기서는 말한 것만 직접 체크하는 자기 채점이다.
 */
export function TeachStep({
  conceptName,
  prompt,
  onDone,
}: {
  conceptName: string;
  prompt: TeachPrompt;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [checked, setChecked] = useState<boolean[]>(() => prompt.checklist.map(() => false));
  const count = checked.filter(Boolean).length;

  return (
    <main className="app-frame">
      <SessionTopBar title="가르치듯 설명하기" current={1} total={1} />
      <div className="px-6 pt-7">
        <div className="text-[13px] text-muted">{conceptName}, 21일 뒤 마지막 확인</div>
        <h1 className="mt-2.5 text-[22px] leading-[1.42] font-semibold tracking-[-0.5px]">
          신입 동료에게 가르치듯 말해 보세요. {prompt.body}
        </h1>
      </div>

      <div className="mx-6 mt-6">
        <SpokenInput
          id="teach-answer"
          value={draft}
          onChange={setDraft}
          placeholder="말하거나 적어 보세요"
          rows={6}
          disabled={revealed}
        />
      </div>

      {revealed ? (
        <section className="fade-up mx-6 mt-7" aria-labelledby="teach-check-title">
          <div className="flex items-baseline justify-between border-b border-line pb-2.5">
            <h2 id="teach-check-title" className="text-[13px] font-medium text-soft">
              말한 것만 직접 체크해요
            </h2>
            <span className="text-[13px] text-soft">
              <b className="text-ink">{count}</b> / {prompt.checklist.length}
            </span>
          </div>
          {prompt.checklist.map((item, i) => (
            <button
              key={item}
              type="button"
              role="checkbox"
              aria-checked={checked[i]}
              onClick={() => setChecked((cs) => cs.map((c, j) => (j === i ? !c : c)))}
              className="flex w-full items-start gap-3 border-b border-line py-3.5 text-left text-[15px] leading-relaxed"
            >
              <span
                className={`mt-1 size-[18px] shrink-0 rounded-full border ${checked[i] ? "border-accent bg-accent" : "border-line-strong"}`}
                aria-hidden="true"
              />
              <span className="flex-1">{item}</span>
            </button>
          ))}
          <p className="mt-3 text-[13px] leading-relaxed text-soft">
            장기 기억은 방금 맞힌 확인 문제로 정해졌어요. 빠진 항목은 지금 한 번 더 떠올려 보세요.
          </p>
        </section>
      ) : (
        <p className="mx-6 mt-4 text-[13px] text-soft">말한 뒤에 확인할 항목이 열려요.</p>
      )}

      <BottomActions>
        {revealed ? (
          <PrimaryButton onClick={onDone}>설명 마치기</PrimaryButton>
        ) : (
          <PrimaryButton onClick={() => setRevealed(true)} disabled={!draft.trim()}>
            말한 것 체크하기
          </PrimaryButton>
        )}
      </BottomActions>
    </main>
  );
}
