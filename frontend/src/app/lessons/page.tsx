import type { Metadata } from "next";
import { LessonsScreen } from "@/features/lessons/LessonsScreen";

export const metadata: Metadata = {
  title: "레슨 | Retrievo",
};

export default function LessonsPage() {
  return <LessonsScreen />;
}
