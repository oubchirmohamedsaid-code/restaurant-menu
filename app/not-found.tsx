import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="text-8xl" aria-hidden>🍽️</span>
      <h1 className="text-4xl font-black">الصفحة غير موجودة</h1>
      <p className="text-muted">يبدو أنك وصلت لمكان فارغ، دعنا نعود للطعام</p>
      <Link
        href="/menu"
        className="rounded-full bg-accent px-8 py-3 font-extrabold text-black transition-transform hover:scale-105"
      >
        العودة إلى المنيو
      </Link>
    </div>
  );
}
