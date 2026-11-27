import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LessonSession } from "@/features/lessons/LessonSession";
import { asLessonSection } from "@/lib/lessonProgress";

export const metadata: Metadata = {
  title: "레슨 | Retrievo",
};

/**
 * 레슨 id는 요청 때만 안다. params를 기다리는 부분만 Suspense 안에 둔다 (cacheComponents)
 * ?at=q3처럼 구역을 주면 본문의 그 자리에서 시작한다. 찾아보기에서 레슨으로 올 때 쓴다
 */
export default function LessonPage({ params, searchParams }: PageProps<"/lessons/[id]">) {
  return (
    <Suspense fallback={<main className="app-frame" aria-busy="true" />}>
      <Lesson params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Lesson({
  params,
  searchParams,
}: {
  params: PageProps<"/lessons/[id]">["params"];
  searchParams: PageProps<"/lessons/[id]">["searchParams"];
}) {
  const [{ id }, { at }] = await Promise.all([params, searchParams]);
  const lessonId = Number(id);
  if (!Number.isSafeInteger(lessonId) || lessonId <= 0) notFound();
  return <LessonSession lessonId={lessonId} at={asLessonSection(at)} />;
}
