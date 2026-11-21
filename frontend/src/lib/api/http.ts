import {
  ApiError,
  type ConceptStatus,
  type Home,
  type LessonDetail,
  type Me,
  type LessonSummary,
  type QuestionView,
  type Report,
  type RetrievoApi,
  type SubmissionResult,
  type SubmitRequest,
  type TodayCheck,
} from "./types";

/*
 * 실제 백엔드 클라이언트. /api 요청은 next.config의 rewrites가 Spring으로 보낸다 (같은 도메인, ADR-010).
 * 로그인: 카카오로 로그인하면 세션 쿠키(SESSION)가 생기고, 브라우저가 알아서 보낸다.
 * 로컬 개발에서는 NEXT_PUBLIC_DEV_USER_ID를 주면 X-Dev-User-Id 헤더로 로그인 없이 쓴다 (백엔드 dev-header=true일 때만).
 * 세션 쿠키를 쓰므로 GET이 아닌 요청에는 CSRF 토큰(XSRF-TOKEN 쿠키 값)을 X-XSRF-TOKEN 헤더로 붙인다.
 */
const devUserId = process.env.NEXT_PUBLIC_DEV_USER_ID;

function csrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body) headers.set("Content-Type", "application/json");
  if (devUserId) headers.set("X-Dev-User-Id", devUserId);
  const method = (init?.method ?? "GET").toUpperCase();
  if (method !== "GET") {
    const token = csrfToken();
    if (token) headers.set("X-XSRF-TOKEN", token);
  }

  const response = await fetch(path, { ...init, headers, credentials: "same-origin" });
  if (response.status === 401 && window.location.pathname !== "/login") {
    // 로그인이 필요하다. 로그인 화면으로 보낸다 (React 밖이라 라우터 대신 주소를 바꾼다)
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- 클라이언트 상태를 버리려고 전체를 새로 불러온다
    window.location.href = "/login";
  }
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const problem = (await response.json()) as { detail?: string };
      if (problem.detail) detail = problem.detail;
    } catch {
      // 본문이 JSON이 아니면 상태 문구만 쓴다
    }
    throw new ApiError(response.status, detail);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const httpApi: RetrievoApi = {
  todayChecks: () => request<TodayCheck[]>("/api/me/delayed-checks/today"),
  lessons: () => request<LessonSummary[]>("/api/lessons"),
  lesson: (lessonId: number) => request<LessonDetail>(`/api/lessons/${lessonId}`),
  lessonQuestions: (lessonId: number) => request<QuestionView[]>(`/api/lessons/${lessonId}/questions`),
  concepts: () => request<ConceptStatus[]>("/api/me/concepts"),
  practiceQuestion: (conceptId: number) => request<QuestionView>(`/api/me/concepts/${conceptId}/practice-question`),
  report: () => request<Report>("/api/me/report"),
  home: () => request<Home>("/api/me/home"),
  me: () => request<Me>("/api/me"),
  logout: () => request<void>("/api/logout", { method: "POST" }),
  submit: (body: SubmitRequest) =>
    request<SubmissionResult>("/api/submissions", { method: "POST", body: JSON.stringify(body) }),
};
