import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { authEnabled } from "@/lib/auth.mjs";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  if (!authEnabled()) redirect("/");
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <LoginForm />
    </main>
  );
}
