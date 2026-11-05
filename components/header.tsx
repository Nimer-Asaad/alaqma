import Link from "next/link";
import { logout } from "@/app/actions";

export default function Header({ title, back }: { title: string; back?: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
        {back && (
          <Link href="/" className="-ms-2 rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="رجوع">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}
        <h1 className="flex-1 truncate text-lg font-bold">{title}</h1>
        {!back && (
          <form action={logout}>
            <button type="submit" className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">
              خروج
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
