/** 문제를 불러오는 동안의 자리 표시. 문제 화면과 같은 자리에 같은 크기로 둬서, 불러온 뒤 화면이 튀지 않는다 */
export function SessionSkeleton() {
  return (
    <main className="app-frame" aria-busy="true" aria-label="문제를 불러오는 중">
      <div className="h-14 shrink-0" />
      <div className="mx-6 h-1 rounded-full bg-line-strong" />
      <div className="px-6 pt-7">
        <div className="h-3 w-32 rounded bg-surface" />
        <div className="mt-4 h-6 w-full rounded bg-surface" />
        <div className="mt-2 h-6 w-3/5 rounded bg-surface" />
        <div className="mt-8 flex flex-col gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-2xl bg-surface" />
          ))}
        </div>
      </div>
    </main>
  );
}
