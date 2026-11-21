import type { Metadata } from "next";
import { LoginScreen } from "@/features/login/LoginScreen";

export const metadata: Metadata = {
  title: "로그인 | Retrievo",
};

export default function LoginPage() {
  return <LoginScreen />;
}
