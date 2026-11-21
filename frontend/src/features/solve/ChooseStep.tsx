"use client";

import { CodeBlock, type LineMark } from "@/components/ui/CodeBlock";
import { ConfidenceTabs } from "@/components/ui/ConfidenceTabs";
import { CheckIcon } from "@/components/ui/icons";
import type { Confidence, QuestionView } from "@/lib/api";
import { formatLines, parseLines } from "@/lib/grading";

const LETTERS = "ABCDEFGH";

export function ChooseStep({
  question: q,
  context,
  selected,
  confidence,
  onSelect,
  onConfidence,
}: {
  question: QuestionView;
  /** 질문 위에 작게 보이는 맥락. 예: "JPA N+1 문제, 틀렸던 문제 다시" */
  context: string;
  selected: string | null;
  confidence: Confidence | null;
  onSelect: (selected: string | null) => void;
  onConfidence: (confidence: Confidence) => void;
}) {
  return (
    <div className="pb-4">
      <div className="px-6 pt-8 text-[13px] text-muted">{context}</div>
      <h1 className="mx-6 mt-2.5 text-[17px] leading-normal font-semibold tracking-[-0.4px]">{q.body}</h1>

      {q.type === "LINE_PICK" && q.code ? (
        <LinePick code={q.code} selected={selected} onSelect={onSelect} />
      ) : (
        <>
          {q.code && q.type !== "OX" && (
            <div className="mx-6 mt-5">
              <CodeBlock code={q.code} />
            </div>
          )}
          {q.type === "OX" ? (
            <OxChoice selected={selected} onSelect={onSelect} />
          ) : (
            <Choices choices={q.choices ?? []} selected={selected} onSelect={onSelect} />
          )}
        </>
      )}

      <div className="mx-6 mt-9">
        <h2 className="text-[13px] font-medium text-muted">이 답, 얼마나 확실한가요?</h2>
        <div className="mt-3">
          <ConfidenceTabs value={confidence} onChange={onConfidence} />
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-soft">확실하다고 했는데 틀리면 따로 모아 다시 물어봐요.</p>
      </div>
    </div>
  );
}

function Choices({
  choices,
  selected,
  onSelect,
}: {
  choices: string[];
  selected: string | null;
  onSelect: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="보기" className="mx-6 mt-4 flex flex-col gap-2">
      {choices.map((choice, i) => {
        const value = String(i + 1);
        const on = selected === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onSelect(value)}
            className={`flex min-h-[58px] w-full items-center gap-3.5 rounded-2xl border px-4 py-3 text-left text-[15px] ${
              on ? "border-accent bg-accent/15 font-semibold text-accent-ink" : "tile font-medium"
            }`}
          >
            <span className={`w-3.5 text-[13px] font-semibold ${on ? "text-accent" : "text-faint"}`}>{LETTERS[i]}</span>
            <span className="flex-1">{choice}</span>
            {on && <CheckIcon size={18} />}
          </button>
        );
      })}
    </div>
  );
}

function OxChoice({ selected, onSelect }: { selected: string | null; onSelect: (value: string) => void }) {
  return (
    <div role="radiogroup" aria-label="O 또는 X" className="mx-6 mt-6 grid grid-cols-2 gap-2">
      {(["O", "X"] as const).map((value) => {
        const on = selected === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={value === "O" ? "O, 맞다" : "X, 틀리다"}
            onClick={() => onSelect(value)}
            className={`h-28 rounded-2xl border text-5xl font-semibold ${
              on ? "border-accent bg-accent/15 text-accent-ink" : "tile"
            }`}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}

function LinePick({
  code,
  selected,
  onSelect,
}: {
  code: string;
  selected: string | null;
  onSelect: (value: string | null) => void;
}) {
  const picked = parseLines(selected ?? "");
  const marks: Record<number, LineMark> = Object.fromEntries(picked.map((n) => [n, "picked" as const]));
  const toggle = (line: number) => {
    const set = new Set(picked);
    if (set.has(line)) set.delete(line);
    else set.add(line);
    onSelect(set.size ? formatLines(set) : null);
  };

  return (
    <div className="mx-6 mt-5">
      <CodeBlock code={code} marks={marks} onPickLine={toggle} />
      <div className="mt-2.5 flex justify-between text-[13px] text-muted">
        <span>줄을 눌러서 골라요. 여러 줄도 돼요</span>
        {picked.length > 0 && (
          <span>
            <b className="text-ink">{picked.join(", ")}번째 줄</b> 선택됨
          </span>
        )}
      </div>
    </div>
  );
}
