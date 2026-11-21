import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LessonSession } from "@/features/lessons/LessonSession";

export const metadata: Metadata = {
  title: "레슨 | Retrievo",
};

/** 레슨 id는 요청 때만 안다. params를 기다리는 부분만 Suspense 안에 둔다 (cacheComponents) */
export default function LessonPage({ params }: PageProps<"/lessons/[id]">) {
  return (
    <Suspense fallback={<main className="app-frame" aria-busy="true" />}>
      <Lesson params={params} />
    </Suspense>
  );
}

async function Lesson({ params }: { params: PageProps<"/lessons/[id]">["params"] }) {
  const { id } = await params;
  const lessonId = Number(id);
  if (!Number.isSafeInteger(lessonId) || lessonId <= 0) notFound();
  return <LessonSession lessonId={lessonId} />;
}
