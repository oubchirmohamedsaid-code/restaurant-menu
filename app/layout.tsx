import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { CartProvider, SiteHeader, CartDrawer } from "@/components/cart";
import { RESTAURANT_NAME } from "@/lib/utils";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `${RESTAURANT_NAME} | المنيو الإلكتروني`,
  description: "تصفح المنيو الإلكتروني لمطعمنا واستمتع بألذ الأطباق",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col bg-background text-foreground antialiased">
        <CartProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <CartDrawer />
          <footer className="border-t border-line bg-card/50 py-6">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-muted sm:flex-row">
              <p>
                © {new Date().getFullYear()} {RESTAURANT_NAME} — جميع الحقوق محفوظة
              </p>
              <a
                href="https://www.instagram.com/sole_.vibes/?hl=en"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 font-bold transition-colors hover:text-accent"
              >
                <span aria-hidden className="text-lg">📷</span>
                تابعنا على إنستغرام
              </a>
            </div>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
