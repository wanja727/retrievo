import type { Metadata } from "next";
import { CheckSession } from "@/features/check/CheckSession";

export const metadata: Metadata = {
  title: "오늘 꺼내기 | Retrievo",
};

export default function CheckPage() {
  return <CheckSession />;
}
