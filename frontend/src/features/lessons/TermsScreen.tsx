"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { appLessonHref, asLessonSection, lessonSiteOrigin, termsPageUrl } from "@/lib/lessonProgress";
import { useRemote } from "@/lib/useRemote";

/**
 * 찾아보기. 용어를 찾아 짧은 요약을 보고, 그 내용이 있는 레슨의 질문으로 간다.
 * 카드와 찾는 칸은 레슨 사이트의 /terms/에 있고 앱은 그 페이지를 iframe으로 띄운다 (레슨 본문과 같은 방식).
 * 레슨 본문과 달리 iframe을 화면 높이로 두고 그 안에서 스크롤한다. 찾는 칸이 위에 붙어 있어야 해서다.
 *
 * 카드의 레슨 링크를 누르면 앱의 레슨 화면(/lessons/:id?at=q3)으로 간다.
 * 1. 페이지가 준비되면 알리고(terms-ready), 앱이 가진 레슨의 키 목록을 답으로 보낸다 (lessons).
 *    iframe의 onLoad는 쓰지 않는다. 앱이 hydrate되기 전에 iframe이 다 뜨면 onLoad를 놓친다
 * 2. 찾아보기 페이지는 그 목록에 있는 레슨의 링크만 막고, 레슨 키와 구역을 알린다 (open-lesson)
 * 앱에 없는 레슨은 페이지가 막지 않아서 사이트의 레슨이 새 탭으로 열린다.
 * 새 탭은 iframe 안의 클릭으로 열어야 한다. 앱이 메시지를 받고 열면 브라우저가 팝업으로 보고 막는다.
 */
export function TermsScreen() {
  const router = useRouter();
  const fetchLessons = useCallback(() => api.lessons(), []);
  const [load] = useRemote(fetchLessons);
  const lessons = load.status === "ready" ? load.data : null;
  const frameRef = useRef<HTMLIFrameElement>(null);
  // 페이지가 terms-ready를 보낼 때마다 늘린다. iframe이 다시 뜨면(새로 고침) 다시 보내야 해서 횟수로 둔다
  const [readySignals, setReadySignals] = useState(0);

  // 페이지가 준비됐고 목록도 왔으면 보낸다. 둘 중 늦게 온 쪽에서 보내진다
  useEffect(() => {
    if (!lessons || readySignals === 0 || !frameRef.current?.contentWindow) return;
    frameRef.current.contentWindow.postMessage(
      { source: "retrievo", type: "lessons", keys: lessons.map((l) => l.key) },
      lessonSiteOrigin(),
    );
  }, [lessons, readySignals]);

  useEffect(() => {
    const origin = lessonSiteOrigin();
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== frameRef.current?.contentWindow) return;
      const data = e.data as { source?: unknown; type?: unknown; lesson?: unknown; at?: unknown } | null;
      if (!data || data.source !== "dev-lessons") return;
      if (data.type === "terms-ready") setReadySignals((n) => n + 1);
      if (data.type !== "open-lesson" || !lessons || typeof data.lesson !== "string") return;
      const href = appLessonHref(lessons, data.lesson, asLessonSection(data.at));
      if (href) router.push(href);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [lessons, router]);

  return (
    <main className="flex h-dvh w-full flex-col bg-white">
      <header className="flex h-14 shrink-0 items-center border-b border-line px-3">
        <Link href="/lessons" aria-label="뒤로" className="flex size-11 items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M11 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="text-[17px] font-semibold tracking-[-0.3px]">찾아보기</h1>
      </header>
      <iframe
        ref={frameRef}
        src={termsPageUrl()}
        title="찾아보기"
        className="block min-h-0 w-full flex-1 border-0 bg-white"
      />
    </main>
  );
}
