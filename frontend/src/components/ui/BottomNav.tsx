import Link from "next/link";
import type { ReactNode } from "react";

const items = [
  {
    label: "오늘",
    href: "/",
    icon: (
      <>
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
        <path d="M18.5 16v4M16.5 18h4" />
      </>
    ),
  },
  {
    label: "레슨",
    href: "/lessons",
    icon: (
      <>
        <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
        <path d="M5 17a3 3 0 0 1 3-3h11" />
      </>
    ),
  },
  {
    label: "기록",
    href: "/report",
    icon: (
      <>
        <path d="M5 20V11" />
        <path d="M12 20V5" />
        <path d="M19 20v-6" />
      </>
    ),
  },
  {
    label: "나",
    href: "/me",
    icon: (
      <>
        <circle cx="12" cy="8.5" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </>
    ),
  },
] as const satisfies readonly { label: string; href: string; icon: ReactNode }[];

/**
 * 화면 아래에 붙는 메뉴. 내용이 목록이라 메뉴를 띄울 이유가 없다: 붙여야 내용이 메뉴 둘레로 비치지 않고 세로 공간도 덜 쓴다.
 * 지금 화면은 옅은 라벤더 알약과 테마 색으로 표시한다 (ADR-023)
 */
export function BottomNav({ active }: { active: (typeof items)[number]["label"] }) {
  return (
    <nav
      aria-label="주요 메뉴"
      className="bottom-bar sticky bottom-0 z-10 grid shrink-0 grid-cols-4 px-2 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))]"
    >
      {items.map((item) => {
        const current = item.label === active;
        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`flex h-[52px] flex-col items-center justify-center gap-0.5 text-[11px] ${
              current ? "font-semibold text-accent-ink" : "font-medium text-soft"
            }`}
          >
            <span
              className={`flex h-7 w-14 items-center justify-center rounded-full transition-colors ${
                current ? "bg-accent-soft" : ""
              }`}
            >
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={current ? 2 : 1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {item.icon}
              </svg>
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
