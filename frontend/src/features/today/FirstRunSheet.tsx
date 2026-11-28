"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { PrimaryButton } from "@/components/ui/buttons";
import { RecordChip } from "@/components/ui/Record";

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * 첫 사용 때 한 번만 숫자의 뜻을 알려준다. 이후에는 물음표 버튼으로만 본다 (ADR-018)
 * 열리면 시트로 포커스를 옮기고, Tab은 시트 안에서만 돌고, Esc로 닫는다. 닫으면 연 버튼으로 포커스를 돌려준다
 */
export function FirstRunSheet({
  onClose,
  title = "처음이라 한 번만 알려 드려요",
}: {
  onClose: () => void;
  /** 물음표나 "나" 화면에서 다시 열 때는 "숫자의 뜻"처럼 바꿔 쓴다 */
  title?: string;
}) {
  const dialog = useRef<HTMLDivElement>(null);

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !dialog.current) return;
    const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === dialog.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !dialog.current.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  });

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.focus();
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-20 mx-auto flex max-w-[430px] flex-col justify-end">
      <div className="absolute inset-0 bg-[#2b2740]/25" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-run-title"
        tabIndex={-1}
        className="fade-up relative rounded-t-3xl bg-white px-6 pt-3 pb-7 outline-none"
      >
        <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-line-strong" />
        <h2 id="first-run-title" className="text-[22px] font-semibold tracking-[-0.4px]">
          {title}
        </h2>
        <dl className="mt-[18px] flex flex-col gap-4">
          <Row term={<span className="text-[22px] leading-[1.1] font-semibold tracking-[-0.5px]">1/3</span>}>
            <b className="text-ink">큰 숫자</b>는 오늘 꺼낸 개념 수예요. 정해 둔 분량이 아니라, 다시 확인할 때가 된 개념만
            물어요.
          </Row>
          <Row term={<RecordChip best={1} />}>
            레슨 문제를 모두 맞히면 <b className="text-ink">학습 완료</b>예요. 그 뒤로는 3일, 7일, 21일 뒤에 다른 문제로
            다시 물어요.
          </Row>
          <Row term={<RecordChip best={3} />}>
            다시 물었을 때 맞히면 <b className="text-ink">며칠 뒤에도 기억했는지</b>가 남아요. 틀려도 줄지 않아요. 21일
            뒤에도 기억하면 장기 기억이 되고 복습에서 빼요.
          </Row>
        </dl>
        <PrimaryButton onClick={onClose} className="mt-6">
          알겠어요
        </PrimaryButton>
      </div>
    </div>
  );
}

function Row({ term, children }: { term: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3.5">
      <dt className="flex w-[108px] shrink-0 justify-start">{term}</dt>
      <dd className="text-[15px] leading-[1.55] text-sub">{children}</dd>
    </div>
  );
}
