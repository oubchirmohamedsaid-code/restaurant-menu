# خطة نشر الموقع — دليل قابل لإعادة الاستخدام (Playbook)

> هذا هو الدليل الكامل الذي نُفّذ به نشر «مطعم الذواقة» على Vercel + Turso.
> لأي موقع جديد: أرسل هذه الخطة مع اسم المشروع، وسأنفّذها خطوة بخطوة.

---

## 0) المتطلبات المسبقة (تفعل مرة واحدة على الجهاز)

| الأداة | الحساب/التثبيت |
|---|---|
| Node.js 24 LTS | `winget install OpenJS.NodeJS.LTS` |
| Git | `winget install Git.Git` (إن لم يكن موجوداً) |
| GitHub | حساب + إنشاء مستودع فارغ |
| Vercel | حساب (التسجيل عبر GitHub) |
| Turso | حساب على turso.tech |

---

## 1) التحضير المحلي

1. بناء الموقع بـ Next.js (App Router) + TypeScript — يعمل محلياً:
   `npm run dev` → `http://localhost:3000`
2. طبقة بيانات موحّدة في `lib/db.ts` — كل الدوال `async` وواجهة واحدة.
3. التأكد من `npm run lint` و `npm run build` خضراء قبل أي رفع.

---

## 2) دروس السحابة (Serverless) — أهم ما يمنع الكسر

> هذه هي الأخطاء الأربعة التي كادت/كسرت النشر — عالجها في أي مشروع جديد:

1. **`node:sqlite` لا يعمل على Vercel** (ملف محلي فقط).
   → استخدم Turso (libSQL): `npm i @libsql/client`.
   → `getDb()` يختار تلقائياً: إن وُجد `TURSO_URL` → Turso، وإلا القاعدة المحلية.

2. **لا تستورد `node:sqlite` في الأعلى أبداً** (يكسر تحميل الوحدة على Vercel).
   → حمّله كسولاً داخل الدالة فقط: `const { DatabaseSync } = await import("node:sqlite")`.

3. **حارس الإنتاج**: في بيئة الإنتاج بدون `TURSO_URL` اعرض خطأ واضحاً
   («اضبط TURSO_URL في متغيرات Vercel») بدل 500 غامض.

4. **المسجّل (logger):** لا تنشئ مجلد `logs/` أثناء تحميل الوحدة — بيئة Vercel
   **للقراءة فقط** (`/var/task`) فتنهار كل الصفحات مع `ENOENT: mkdir .../logs`.
   → `mkdirSync` داخل `try/catch`، وعند الفشل اكتب للـ console بدلاً من الملف
   (يظهر في تبويب Logs في Vercel).

---

## 3) الرفع إلى GitHub

```bash
git init
git add -A
git commit -m "initial"
git remote add origin https://github.com/<account>/<repo>.git
git push -u origin main
```

- تأكد أن `.gitignore` يمنع: `.env*`, `data/`, `logs/`, `node_modules/`, `.next/`
- **تحقق قبل الرفع:** `git status` — يجب ألا يظهر `.env` (فيه الأسرار).

---

## 4) قاعدة Turso

1. سجّل دخول في [turso.tech](https://turso.tech) → **Create Database**.
2. انسخ **URL** (مثل `libsql://<name>.turso.io`).
3. أنشئ **Token** (Database token) وانسخه (يظهر مرة واحدة).
4. ضعهما في `.env` المحلي:
   ```
   TURSO_URL="libsql://..."
   TURSO_TOKEN="eyJ..."
   ```
5. زرع البيانات في السحابة: `npm run db:seed` ثم `npx tsx scripts/smoke.ts`
   — تتصل تلقائياً بـ Turso لأن `TURSO_URL` موجود.

---

## 5) النشر على Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → **Import** مستودع GitHub.
   (أو إن أُنشئ المشروع بالسحب يدوياً: اربطه بـ **Settings → Git**).
2. **Root Directory**: مجلد التطبيق (إن كان المشروع في مجلد فرعي).
3. **Environment Variables** (Settings → Environment Variables) — أربعة دائماً:
   | الاسم | القيمة |
   |---|---|
   | `TURSO_URL` | رابط القاعدة السحابية |
   | `TURSO_TOKEN` | رمز القاعدة |
   | `ADMIN_PASSWORD` | كلمة مرور الادمن |
   | `SESSION_SECRET` | سر توقيع الجلسة |
   - اختر **Production + Preview** وعلامة **Sensitive**.
4. **Deploy** — ثم كل دفعة جديدة على GitHub تعيد النشر تلقائياً.

---

## 6) إطفاء حماية النشر (مهم جداً)

- **Settings → Deployment Protection → Vercel Authentication** → **Turn off**
  (أو «حماية المعاينات فقط» إن أردت).
- بدون هذا، الزائر غير المسجّل يرى صفحة تسجيل دخول Vercel بدل الموقع.

---

## 7) التحقق النهائي

```bash
# فحص كل المسارات من طرف ثالث (بلا جلسة Vercel)
curl -I https://<project>.vercel.app/menu
curl -I https://<project>.vercel.app/menu/pizza
curl -I https://<project>.vercel.app/admin
```
- المسارات يجب أن تعيد `200` (و`/admin/dashboard` بدون دخول: `307`).
- أي خطأ → **تبويب Logs** في Vercel وانسخ النص الأحمر لإرساله لي.

---

## الأخطاء الشائعة وعلاجها السريع

| العَرَض | السبب | العلاج |
|---|---|---|
| `ENOENT: mkdir '/var/task/logs'` | logger ينشئ مجلداً في بيئة للقراءة فقط | fallback للـ console (القسم 2) |
| `Cannot find module node:sqlite` | استيراد في الأعلى | lazy-load (القسم 2) |
| صفحة «Log in to Vercel» | الحماية مفعّلة | القسم 6 |
| يظهر موقع غريب آخر | الرابط القصير محجوز لمشروع بنفس الاسم | استخدم رابطك الطويل `...-<project>.vercel.app` |
| 500 بعد ضبط المتغيرات | متغيرات أُضيفت بلا إعادة نشر | **Redeploy** من Deployments |
