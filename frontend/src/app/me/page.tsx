import type { Metadata } from "next";
import { MeScreen } from "@/features/me/MeScreen";

export const metadata: Metadata = {
  title: "나 | Retrievo",
};

export default function MePage() {
  return <MeScreen />;
}
