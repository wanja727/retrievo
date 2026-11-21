"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { ArrowRightIcon } from "@/components/ui/icons";
import { LoadError } from "@/components/ui/LoadError";
import { api, apiMode } from "@/lib/api";
import { useRemote } from "@/lib/useRemote";
import { FirstRunSheet } from "../today/FirstRunSheet";

const fetchMe = () => api.me();

const LESSON_SITE = "https://wanja727.github.io/dev-lessons/";
const SOURCE = "https://github.com/wanja727/retrievo";

/**
 * 나: 프로필과, 이 앱이 왜 이렇게 묻는지 다시 볼 수 있는 곳.
 * 로그아웃은 실제 백엔드(카카오 로그인)를 쓸 때만 보인다.
 */
export function MeScreen() {
  const [state, retry] = useRemote(fetchMe);
  const [helpOpen, setHelpOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await api.logout();
    } finally {
      // 세션이 끝났으니 로그인 화면으로. 화면에 남은 내 데이터를 버리려고 새로 불러온다. 서버 응답이 실패해도 보낸다
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- 클라이언트 상태를 버리려고 전체를 새로 불러온다
      window.location.href = "/login";
    }
  };

  if (state.status === "error") {
    return <LoadError what="내 정보를" message={state.message} onRetry={retry} />;
  }

  const me = state.status === "ready" ? state.data : null;

  return (
    <main className="app-frame">
      <header className="flex h-14 shrink-0 items-center px-6">
        <h1 className="text-[17px] font-semibold tracking-[-0.3px]">나</h1>
      </header>

      <section className="hero mx-4 mt-1 flex items-center gap-4 px-5 py-5" aria-label="프로필">
        {me ? (
          <>
            <span
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-[22px] font-semibold text-white"
              aria-hidden="true"
            >
              {me.nickname.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[22px] leading-tight font-semibold tracking-[-0.6px]">{me.nickname}</div>
              <p className="mt-1 text-[13px] text-muted">
                <b className="font-semibold text-accent-ink">{me.days}일째</b> 꺼내는 중
              </p>
              <p className="text-[13px] text-soft">{formatDate(me.joinedOn)}부터</p>
            </div>
          </>
        ) : (
          <div aria-busy="true" aria-label="불러오는 중">
            <div className="h-7 w-28 rounded bg-white/70" />
            <div className="mt-2 h-4 w-44 rounded bg-white/70" />
          </div>
        )}
      </section>

      <section className="mx-4 mt-6" aria-labelledby="method-title">
        <h2 id="method-title" className="px-2 pb-2 text-[13px] font-semibold text-sub">
          Retrievo가 묻는 방식
        </h2>
        <div className="card overflow-hidden">
          <Row href="/me/method" title="기억을 관리하는 방법" note="언제 다시 묻는지와 그 근거 8가지" />
          <Row onClick={() => setHelpOpen(true)} title="숫자의 뜻" note="처음에 본 안내를 다시 봐요" />
        </div>
      </section>

      <section className="mx-4 mt-6" aria-labelledby="about-title">
        <h2 id="about-title" className="px-2 pb-2 text-[13px] font-semibold text-sub">
          앱 정보
        </h2>
        <div className="card overflow-hidden">
          <Row href={LESSON_SITE} external title="레슨 사이트" note="레슨 본문과 검증 테스트를 공개한 곳" />
          <Row href={SOURCE} external title="소스 코드" note="GitHub의 wanja727/retrievo" />
          <div className="flex h-14 items-center justify-between px-4 text-[15px] font-medium">
            <span>버전</span>
            <span className="text-[13px] font-normal text-soft">{process.env.NEXT_PUBLIC_APP_VERSION || "개발 중"}</span>
          </div>
        </div>
      </section>

      {apiMode === "http" && (
        <section className="mx-4 mt-6" aria-label="계정">
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="card flex h-14 w-full items-center px-4 text-left text-[15px] text-muted disabled:text-faint"
          >
            {loggingOut ? "로그아웃하는 중" : "로그아웃"}
          </button>
        </section>
      )}

      <div className="mt-auto pt-8" />
      <BottomNav active="나" />

      {helpOpen && <FirstRunSheet title="숫자의 뜻" onClose={() => setHelpOpen(false)} />}
    </main>
  );
}

function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

function Row({
  title,
  note,
  href,
  external,
  onClick,
}: {
  title: string;
  note: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
}) {
  const body: ReactNode = (
    <>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium tracking-[-0.2px]">{title}</div>
        <div className="mt-0.5 text-[13px] text-soft">{note}</div>
      </div>
      <ArrowRightIcon size={16} className={`shrink-0 text-faint ${external ? "-rotate-45" : ""}`} />
    </>
  );
  const cls = "flex h-16 w-full items-center gap-3 border-b border-line px-4 text-left last:border-b-0";
  if (href && external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {body}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}
