import type { Metadata } from "next";
import LoginForm from "./login-form";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/icon.svg" alt="" className="mx-auto mb-4 h-16 w-16" />
          <h1 className="text-2xl font-bold">مخزون الجملة</h1>
          <p className="mt-1 text-slate-500">دخول المدير</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
