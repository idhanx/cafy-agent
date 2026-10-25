import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <LoginForm />
    </main>
  );
}
