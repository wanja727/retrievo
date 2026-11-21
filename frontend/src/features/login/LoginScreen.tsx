"use client";

import Link from "next/link";
import { apiMode } from "@/lib/api";
import { useClientValue } from "@/lib/useRemote";

const KAKAO_LOGIN = "/oauth2/authorization/kakao";

function loginFailed(): boolean {
  return new URLSearchParams(window.location.search).has("error");
}

/**
 * 로그인. 카카오만 쓴다 (ADR-010). 비밀번호를 받지 않는다.
 * 카카오 로그인 버튼은 카카오 디자인 가이드(노란 배경, 말풍선 심볼)를 따른다. 화면의 나머지는 파스텔 테마다 (ADR-023).
 */
export function LoginScreen() {
  const failed = useClientValue(loginFailed, false);

  return (
    <main className="app-frame celebrate">
      <section className="flex flex-1 flex-col justify-center px-6">
        <div className="flex items-center gap-2 text-[15px] font-semibold">
          <span
            className="flex size-7 items-center justify-center rounded-lg bg-accent text-[15px] font-bold text-white"
            aria-hidden="true"
          >
            R
          </span>
          Retrievo
        </div>
        <h1 className="mt-5 text-[40px] leading-[1.25] font-semibold tracking-[-1.2px]">
          꺼낼수록
          <br />
          <span className="text-accent-ink">쌓이는 지식</span>
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          답을 먼저 꺼내고, 3일·7일·21일 뒤에 다른 문제로 다시 확인해요.
        </p>
      </section>

      <div className="px-6 pb-8">
        {failed && (
          <p role="alert" className="mb-3 text-center text-[13px] text-wrong">
            로그인하지 못했어요. 다시 시도해 주세요.
          </p>
        )}
        {apiMode === "mock" ? (
          <Link
            href="/"
            className="btn-primary flex h-14 w-full items-center justify-center rounded-full text-[17px] font-semibold text-white"
          >
            목 API로 둘러보기
          </Link>
        ) : (
          <a
            href={KAKAO_LOGIN}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] text-[17px] font-semibold text-black/85"
          >
            <KakaoSymbol />
            카카오 로그인
          </a>
        )}
        <p className="mt-3 text-center text-[13px] leading-relaxed text-soft">
          비밀번호는 받지 않아요. 카카오에서 닉네임만 받아 와요.
        </p>
      </div>
    </main>
  );
}

/** 카카오 말풍선 심볼 */
function KakaoSymbol() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#000000"
        d="M12 3C6.48 3 2 6.58 2 11c0 2.85 1.86 5.35 4.66 6.77-.2.74-.74 2.7-.85 3.12-.13.52.19.51.4.37.17-.11 2.62-1.78 3.68-2.5.69.1 1.39.15 2.11.15 5.52 0 10-3.58 10-8S17.52 3 12 3z"
      />
    </svg>
  );
}
