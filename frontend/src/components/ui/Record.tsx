import { recordLabel, recordNote } from "@/lib/memory";

/** 기억 기록이 늘었을 때만 보여준다: 어디에서 어디로 늘었는지와 무엇을 해냈는지 */
export function RecordUp({ before, after }: { before: number; after: number }) {
  return (
    <section className="rounded-[20px] bg-accent-soft px-4 py-4" aria-label="더 오래 간 기억">
      <div className="text-[13px] text-muted">기억이 더 오래 가요</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        {before >= 1 && (
          <>
            <span className="text-[15px] font-medium text-soft">{recordLabel(before)}</span>
            <span className="text-[15px] text-soft" aria-hidden="true">
              →
            </span>
          </>
        )}
        <span className="text-[22px] leading-none font-semibold tracking-[-0.6px] text-accent-ink">
          {recordLabel(after)}
        </span>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-sub">{recordNote(after)}</p>
    </section>
  );
}

/** 목록 오른쪽의 기억 기록. 배움을 마친 뒤부터 테마 색으로 보인다 */
export function RecordChip({ best }: { best: number }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[13px] whitespace-nowrap ${
        best >= 1 ? "bg-accent-soft font-semibold text-accent-ink" : "bg-surface text-soft"
      }`}
    >
      {recordLabel(best)}
    </span>
  );
}
