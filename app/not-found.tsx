import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-lg">الصفحة أو المنتج غير موجود.</p>
      <Link href="/" className="btn-primary">
        العودة إلى الكتالوج
      </Link>
    </main>
  );
}
