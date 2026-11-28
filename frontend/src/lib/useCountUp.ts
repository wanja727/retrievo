"use client";

import { useEffect, useState } from "react";

/**
 * 0에서 target까지 올라가는 숫자. 화면에 처음 나올 때 값이 쌓였다는 것을 보여 준다 (docs/design.md "움직임").
 * 움직임 줄이기를 켠 사용자에게는 바로 target을 보여 준다.
 */
export function useCountUp(target: number, ms = 700): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now: number) {
      const t = still ? 1 : Math.min(1, (now - start) / ms);
      // 끝으로 갈수록 느려진다
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);

  return value;
}
