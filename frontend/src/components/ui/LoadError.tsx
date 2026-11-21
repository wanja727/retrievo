/** 불러오기에 실패했을 때. what은 "문제를", "레슨을"처럼 목적어로 */
export function LoadError({ what, message, onRetry }: { what: string; message: string; onRetry: () => void }) {
  return (
    <main className="app-frame items-center justify-center px-6 text-center">
      <p className="text-[15px] text-muted">{what} 불러오지 못했어요.</p>
      <p className="mt-1 text-[13px] text-faint">{message}</p>
      <button type="button" onClick={onRetry} className="mt-4 text-[15px] font-semibold underline">
        다시 불러오기
      </button>
    </main>
  );
}
