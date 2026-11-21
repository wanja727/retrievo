import Link from "next/link";
import { CloseIcon } from "./icons";

/** 학습 화면 위: 닫기, 가운데 제목, 칸으로 나눈 진행 막대 */
export function SessionTopBar({
  title,
  current,
  total,
  closeHref = "/",
}: {
  title: string;
  current: number;
  total: number;
  /** 닫기를 누르면 갈 곳. 오늘 화면에서 왔으면 "/", 레슨에서 왔으면 레슨 목록 */
  closeHref?: string;
}) {
  return (
    <header className="shrink-0">
      <div className="grid h-14 grid-cols-[44px_1fr_44px] items-center px-3">
        <Link href={closeHref} aria-label="닫기" className="flex size-11 items-center justify-center">
          <CloseIcon />
        </Link>
        <div className={`text-center text-[13px] font-medium text-muted`}>{title}</div>
      </div>
      <div
        role="progressbar"
        aria-label="진행"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
        className="mx-6 grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className={`h-1 rounded-full ${i < current ? "bar-fill" : "bg-line-strong"}`} />
        ))}
      </div>
    </header>
  );
}
