import type { Metadata } from "next";
import { ReportScreen } from "@/features/report/ReportScreen";

export const metadata: Metadata = {
  title: "기록 | Retrievo",
};

export default function ReportPage() {
  return <ReportScreen />;
}
