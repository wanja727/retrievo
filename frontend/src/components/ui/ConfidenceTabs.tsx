import type { Confidence } from "@/lib/api";

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  SURE: "확실",
  UNSURE: "애매",
  UNKNOWN: "모름",
};

const ORDER: Confidence[] = ["SURE", "UNSURE", "UNKNOWN"];

/** 확신도: 확실 / 애매 / 모름. 옅은 면 위에서 고른 칸만 흰 알약으로 떠오른다 */
export function ConfidenceTabs({
  value,
  onChange,
}: {
  value: Confidence | null;
  onChange: (value: Confidence) => void;
}) {
  return (
    <div role="radiogroup" aria-label="확신도" className="tile grid grid-cols-3 gap-1 rounded-2xl p-1">
      {ORDER.map((c) => {
        const on = value === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(c)}
            className={`h-11 rounded-xl text-[15px] transition-colors ${
              on ? "soft-shadow bg-white font-semibold text-accent-ink" : "font-medium text-soft"
            }`}
          >
            {CONFIDENCE_LABEL[c]}
          </button>
        );
      })}
    </div>
  );
}
