"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">البريد الإلكتروني</span>
        <input name="email" type="email" required autoComplete="email" dir="ltr" className="input" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">كلمة المرور</span>
        <input name="password" type="password" required autoComplete="current-password" dir="ltr" className="input" />
      </label>
      {state?.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "جارٍ الدخول…" : "دخول"}
      </button>
    </form>
  );
}
