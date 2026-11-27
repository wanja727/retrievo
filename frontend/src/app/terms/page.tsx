import type { Metadata } from "next";
import { TermsScreen } from "@/features/lessons/TermsScreen";

export const metadata: Metadata = {
  title: "찾아보기 | Retrievo",
};

export default function TermsPage() {
  return <TermsScreen />;
}
