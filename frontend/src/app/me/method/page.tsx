import type { Metadata } from "next";
import { MethodScreen } from "@/features/me/MethodScreen";

export const metadata: Metadata = {
  title: "기억을 관리하는 방법 | Retrievo",
};

export default function MethodPage() {
  return <MethodScreen />;
}
