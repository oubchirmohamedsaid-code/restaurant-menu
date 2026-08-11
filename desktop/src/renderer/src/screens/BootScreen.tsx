import { RefreshCw } from "lucide-react";
import { TitleBar } from "../components/TitleBar";
import { Spinner } from "../components/ui";

export function BootScreen({ dbError, onRetry }: { dbError: string | null; onRetry: () => void }) {
  return (
    <div className="flex h-screen flex-col">
      <TitleBar />
      <div className="flex flex-1 items-center justify-center p-8">
        {dbError ? (
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 text-center shadow-card">
            <p className="text-2xl">⚠️</p>
            <h2 className="mt-2 text-lg font-black text-foreground">تعذر الاتصال بقاعدة البيانات</h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-muted">{dbError}</p>
            <button
              onClick={onRetry}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-white transition-colors hover:bg-accent-strong"
            >
              <RefreshCw className="size-4" />
              إعادة المحاولة
            </button>
          </div>
        ) : (
          <Spinner label="جاري تشغيل OGTX..." />
        )}
      </div>
    </div>
  );
}
