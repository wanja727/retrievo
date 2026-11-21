import { CodeBlock, type LineMark } from "@/components/ui/CodeBlock";
import { CONFIDENCE_LABEL } from "@/components/ui/ConfidenceTabs";
import { RecordUp } from "@/components/ui/Record";
import type { QuestionView, SubmissionResult } from "@/lib/api";
import { describeAnswer, parseLines } from "@/lib/grading";

/** 결과에 붙이는 안내. 확신과 결과가 어긋난 경우에만 보여준다 */
function noteFor(result: SubmissionResult): string | null {
  if (!result.correct && result.confidence === "SURE") {
    return "확실했는데 틀린 답이에요. 이런 개념은 따로 모아 먼저 다시 물어요.";
  }
  if (result.correct && result.confidence !== "SURE") {
    return "확신 없이 맞힌 답은 잘 남지 않아요. 해설을 한 번 더 읽어 두세요.";
  }
  return null;
}

export function ResultStep({ question: q, result }: { question: QuestionView; result: SubmissionResult }) {
  const answer = describeAnswer(q.type, result.answer, q.choices);
  const mine = describeAnswer(q.type, result.selected, q.choices);
  const big = answer.length <= 4;
  const note = noteFor(result);

  const marks: Record<number, LineMark> = {};
  if (q.type === "LINE_PICK") {
    for (const n of parseLines(result.selected)) marks[n] = "wrong";
    for (const n of parseLines(result.answer)) marks[n] = "answer";
  }

  return (
    <div className="fade-up pb-4">
      <div className="px-6 pt-7">
        <div
          className={`inline-flex h-7 items-center rounded-full px-3 text-[13px] font-semibold ${
            result.correct ? "bg-ok-soft text-ok-ink" : "bg-wrong-soft text-wrong-ink"
          }`}
        >
          {result.correct ? "맞았어요" : "틀렸어요"}
        </div>
        <div className="mt-4 text-[13px] text-muted">정답</div>
        <div className={`mt-1.5 flex gap-4 ${big ? "items-end" : "flex-col"}`}>
          <h1
            className={
              big
                ? "text-[88px] leading-[0.95] font-semibold tracking-[-5px]"
                : "text-[28px] leading-snug font-semibold tracking-[-0.8px]"
            }
          >
            {answer}
          </h1>
          <div className={`text-[15px] leading-relaxed text-muted ${big ? "pb-2" : ""}`}>
            내 답 {result.correct ? mine : <s className="text-faint">{mine}</s>}, {CONFIDENCE_LABEL[result.confidence]}
            <span className="mt-0.5 block text-soft">{result.retrievals.toLocaleString("ko-KR")}번째로 꺼낸 답</span>
          </div>
        </div>
      </div>

      {result.record && (
        <div className="mx-6 mt-6">
          <RecordUp before={result.record.before} after={result.record.after} />
        </div>
      )}

      {note && (
        <div
          className={`mx-6 mt-4 rounded-2xl px-4 py-3.5 text-[13px] leading-relaxed ${
            result.correct ? "tile text-sub" : "bg-wrong-soft/80 text-wrong-ink"
          }`}
        >
          {note}
        </div>
      )}

      <section className="mx-6 mt-7" aria-labelledby="explanation-title">
        <h2 id="explanation-title" className="text-[13px] font-medium text-soft">
          해설
        </h2>
        <p className="mt-2 text-[15px] leading-[1.7] text-ink-2">{result.explanation}</p>
        {q.type === "LINE_PICK" && q.code && (
          <div className="mt-5">
            <CodeBlock code={q.code} marks={marks} />
            <div className="mt-2 flex gap-4 text-[13px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-0.5 bg-ok" />
                정답 줄
              </span>
              {!result.correct && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-0.5 bg-wrong" />내가 고른 줄
                </span>
              )}
            </div>
          </div>
        )}
        {result.sourceUrl && (
          <a
            href={result.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-block text-[13px] font-medium text-soft underline underline-offset-2"
          >
            근거 보기
          </a>
        )}
      </section>
    </div>
  );
}
