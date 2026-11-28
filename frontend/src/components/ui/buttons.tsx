import Link from "next/link";
import type { ReactNode } from "react";

type Common = { children: ReactNode; className?: string };
type AsLink = Common & { href: string; onClick?: never; disabled?: never; type?: never };
type AsButton = Common & { href?: never; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" };

const primary =
  "flex h-14 w-full items-center justify-center gap-2 rounded-full text-[17px] font-semibold transition-[background-color,scale] duration-150 active:scale-[0.98] motion-reduce:active:scale-100";

/** 화면 아래의 테마 색 알약 버튼. 화면마다 하나만 둔다 */
export function PrimaryButton(props: AsLink | AsButton) {
  const tone = props.disabled ? "bg-line-strong text-soft" : "btn-primary text-white";
  const cls = `${primary} ${tone} ${props.className ?? ""}`;
  if (props.href !== undefined) {
    return (
      <Link href={props.href} className={cls}>
        {props.children}
      </Link>
    );
  }
  return (
    <button type={props.type ?? "button"} onClick={props.onClick} disabled={props.disabled} className={cls}>
      {props.children}
    </button>
  );
}

/** 알약 버튼 아래의 보조 텍스트 버튼 */
export function TextButton(props: AsLink | AsButton) {
  const cls = `flex h-11 w-full items-center justify-center text-[15px] font-medium text-muted ${props.className ?? ""}`;
  if (props.href !== undefined) {
    return (
      <Link href={props.href} className={cls}>
        {props.children}
      </Link>
    );
  }
  return (
    <button type={props.type ?? "button"} onClick={props.onClick} disabled={props.disabled} className={cls}>
      {props.children}
    </button>
  );
}

/** 화면 아래에 붙는 버튼 영역. 내용이 길어도 버튼은 늘 보인다 */
export function BottomActions({ children }: { children: ReactNode }) {
  return (
    <div className="bottom-bar sticky bottom-0 mt-auto flex flex-col gap-1 px-6 pt-4 pb-6">
      {children}
    </div>
  );
}
