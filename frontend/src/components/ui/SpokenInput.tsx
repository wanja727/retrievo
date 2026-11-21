"use client";

import { MicIcon } from "@/components/ui/icons";
import { useSpeechInput } from "@/lib/useSpeechInput";

/** 적거나 말해서 답하는 칸 */
export function SpokenInput({
  id,
  value,
  onChange,
  placeholder,
  rows = 3,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
  disabled?: boolean;
}) {
  const speech = useSpeechInput((text) => onChange(value ? `${value} ${text}` : text));
  return (
    <div className="flex items-start gap-1 rounded-2xl border border-accent-line py-2 focus-within:border-accent pr-1.5 pl-4">
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-relaxed outline-none placeholder:text-faint disabled:text-sub"
      />
      {speech.supported && !disabled && (
        <button
          type="button"
          onClick={speech.toggle}
          aria-label={speech.listening ? "말하기 멈추기" : "말로 답하기"}
          aria-pressed={speech.listening}
          className={`flex size-11 shrink-0 items-center justify-center rounded-full ${speech.listening ? "bg-accent text-white" : ""}`}
        >
          <MicIcon />
        </button>
      )}
    </div>
  );
}
