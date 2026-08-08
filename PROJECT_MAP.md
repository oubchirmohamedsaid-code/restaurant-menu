# PROJECT_MAP — Restaurant Menu (المنيو الإلكتروني)

> آخر تحديث: 2026-08-08 | مسار الجذر: `restaurant-menu/` (مجلد فرعي، مجزول عن ملفات المتجر القائمة)
> سجل قرارات: **DB Runtime = `node:sqlite` محلياً + Turso (libSQL) على السحابة** — محلياً: `node:sqlite` (DatabaseSync) صفر تبعيات؛ عند النشر (Vercel): `@libsql/client` يتصل بقاعدة Turso عبر `TURSO_URL`/`TURSO_TOKEN`. الانتقال تلقائي في `lib/db.ts` (دوال async موحّدة).

## [TECH_STACK]

| طبقة | اختيار | الإصدار (تم التحقق 2026-08-08) | ملاحظات |
|---|---|---|---|
| Runtime | Node.js | **24 LTS (Krypton)** — 24.19.0 | مثبّت عبر winget |
| Framework | Next.js (App Router) | **16.3.0** (LTS, 2026-08-03) | React 19 + TS مدمجان |
| Styling | Tailwind CSS | **4.3.3** (2026-07-16) | تصميم داكن (dark-first) عبر tokens |
| Animations | Motion (خليفة framer-motion) | **13.0.0** (2026-08-05) | الاستيراد من `motion/react` |
| DB | SQLite: **`node:sqlite` محلياً** + **Turso (libSQL) عن بُعد** عبر `@libsql/client` | مدمج + 0.17.4 | `getDb()` يختار تلقائياً: `TURSO_URL` موجود → Turso، وإلا ملف `data/menu.db`؛ schema idempotent يُطبّق عند الإقلاع على كليهما |
| Auth | HMAC-session مكتوبة يدوياً (`node:crypto`) | — | بدون تبعيات؛ كلمة مرور واحدة من `.env` |

قواعد: لا تُستخدم أي حزمة Deprecated. أي إصدار ناقص يُثبَّت بأحدث Stable وقت التنفيذ ويُوثَّق هنا.

## [SYSTEM_FLOW]

**رحلة الزبون:** `/` (Hero ترحيبي + أنيميشن) → زر «تفقد الآن» → `/menu` (شبكة الأصناف بصور: مشروبات / بيتزا / برجر …) → `/menu/[slug]` (منتجات الصنف؛ زر «المكونات 🧅» يفتح نافذة تخصيص: إزالة مكونات أساسية أو إضافة إضافات بسعر إضافي) → إضافة إلى السلة (Context + localStorage، سطر فريد لكل تخصيص عبر `key`) → درج السلة → «تأكيد الطلب» يُرسل Server Action يُخزّن الطلب في `orders` (بلا واتساب).

**رحلة الادمن:** `/admin` (تسجيل دخول بكلمة مرور واحدة) → HttpOnly Cookie موقّع HMAC → `/admin/dashboard` (شبكة الأصناف) → `/admin/categories/[slug]` (صفحة مستقلة لكل صنف: صورة الصنف + CRUD للأطباق + مكونات الطبق بأقسامها + الصور تُرفع من الجهاز) → `/admin/orders` (قائمة طلبات الزبائن مع الحذف) → Server Actions (محروسة بالمصادقة) → `node:sqlite`.

**تدفق البيانات:** صفحات الخادم (Server Components) تقرأ `node:sqlite` مباشرة عبر `lib/db.ts`؛ الطفرات عبر Server Actions فقط؛ السلة Client-side (ترسل بنودها عند تأكيد الطلب ويُعاد حساب السعر خادمياً للمصادقة). الصفحات المقرؤة للبيانات `force-dynamic` كي تنعكس تعديلات الادمن فوراً.

## [ARCHITECTURE]

```
restaurant-menu/
├── app/
│   ├── layout.tsx / globals.css        # RTL + سمة داكنة + خطوط عربية (Cairo) + تذييل إنستغرام
│   ├── not-found.tsx                   # 404 عربي أنيق
│   ├── page.tsx                        # Hero ترحيبي (Motion)
│   ├── menu/page.tsx                   # شبكة الأصناف (صور)
│   ├── menu/[slug]/page.tsx            # منتجات صنف + تمرير المكونات
│   ├── orders/actions.ts               # placeOrderAction: تحقق/حساب سعر خادمي + تخزين الطلب
│   ├── admin/page.tsx                  # تسجيل دخول (بوابة: مصادق → /dashboard)
│   ├── admin/actions.ts                # Server Actions محروسة: login/logout/CRUD/مكونات/صورة صنف/حذف طلب (رفع ملفات)
│   ├── admin/dashboard/page.tsx        # شبكة الأصناف (بطاقات → صفحات الأصناف) (بوابة: غير مصادق → /admin)
│   ├── admin/categories/[slug]/page.tsx# صفحة صنف مستقلة: صورة + أطباق + مكونات (بوابة: غير مصادق → /admin)
│   └── admin/orders/page.tsx           # قائمة طلبات الزبائن (بوابة: غير مصادق → /admin)
├── components/
│   ├── menu-ui.tsx                     # Hero, بطاقة صنف (صورة), بطاقة منتج + نافذة تخصيص المكونات (أساسية/إضافات، إلزامية 🔒)
│   ├── cart.tsx                        # CartProvider + SiteHeader + درج السلة (تأكيد طلب → orders)
│   └── admin-ui.tsx                    # نماذج/جداول الادمن (useActionState) + مدير مكونات (أقسام + إلزامي) + الطلبات
├── lib/
│   ├── db.ts                           # طبقة بيانات async مزدوجة: node:sqlite محلياً / Turso (TURSO_URL) — schema idempotent + ترحيل imageUrl/isRequired + CRUD مصنف
│   ├── upload.ts                       # رفع صور من الجهاز: تحقق صيغة/حجم (حد 4MB) → public/uploads
│   ├── session.ts                      # HMAC sign/verify + verifyPassword (HttpOnly)
│   ├── cart.ts                         # منطق سلة نقي: count/total/formatOrderLine (قابل للاختبار)
│   ├── logger.ts                       # تسجيل async غير حظري: DEBUG/INFO/WARN/ERROR → logs/app.log
│   └── utils.ts                        # RESTAURANT_NAME + تنسيق السعر (CURRENCY دج من env)
├── scripts/
│   ├── seed.ts                         # 4 أصناف بصور + 19 منتج + مكونات أمثلة (idempotent)
│   └── smoke.ts                        # تحقق آلي: بيانات + CRUD + مكونات + طلبات + سلة + مصادقة
├── data/                               # menu.db (SQLite) — مُستبعد من git
├── logs/                               # app.log — مُستبعد من git
├── public/
└── PROJECT_MAP.md
```

مبادئ: تقسيم حسب النطاق (Domain-Driven)؛ `lib/` فقط للمنطق المتكرر فعلياً؛ لا Micro-files؛ لا مسارات API — Server Actions فقط؛ Zero feature creep.

**Schema (SQLite):**
- `Category`: id, slug(unique), nameAr, icon(emoji), imageUrl, sortOrder
- `Product`: id, categoryId(FK→Category ON DELETE CASCADE), name, description, priceCents(Int), imageUrl, isAvailable(0/1), sortOrder
- `Ingredient`: id, productId(FK→Product ON DELETE CASCADE), name, priceCents, isExtra(0 أساسي/1 إضافة بسعر), **isRequired(0/1 إلزامي لا يُزال)**, sortOrder
- `orders`: id, items(TEXT=JSON array من بنود منسّقة), totalCents, createdAt

## [ORPHANS & PENDING]

- [x] **Node.js 24 LTS** — مثبّت (winget, 24.19.0).
- [x] **M0 Scaffold** — Next 16.3.0 + TS + Tailwind 4.3.3 + Motion 13.
- [x] **M1 Data layer** — schema idempotent + seed (4 أصناف / 19 منتج).
- [x] **M2 مسار الزبون** — `/` → `/menu` → `/menu/[slug]` (200 بتحقق HTTP؛ 404 للصنف المجهول).
- [x] **M3 السلة** — Context + localStorage + درج متحرك (تحقق آلي للمجاميع/النص).
- [x] **M4 لوحة الادمن** — login (HMAC session) + CRUD محمي (بوابة 307/200 + انعكاس فوري مثبت).
- [x] **M5 الصقل** — أنيميشنات Motion + استجابة + تسجيل + `build`/`lint`/`smoke` خضراء.
- [x] **M6 العملة دج** — `CURRENCY` افتراضياً دج (دينار جزائري) + تسميات الادمن.
- [x] **M7 مكوّنات الطبق** — جدول `Ingredient` + نافذة تخصيص للزبون (إزالة/إضافة بسعر) + إدارة من الادمن (اسم/سعر/نوع) + إعادة حساب السعر خادمياً.
- [x] **M8 صور الأصناف** — `Category.imageUrl` (ترحيل ALTER للقواعد القائمة) تُعرض بدل الإيموجي ويُعدّلها الادمن.
- [x] **M9 الطلبات للادمن** — جدول `orders` + `placeOrderAction` + صفحة `/admin/orders` (حذف)؛ واتساب أُزيل كلياً.
- [x] **M10 تذييل إنستغرام** — رابط `https://www.instagram.com/sole_.vibes/?hl=en` في التذييل.
- [x] **M11 رفع الصور من الجهاز** — `lib/upload.ts` (تحقق صيغة/حجم، حد 4MB، حفظ في `public/uploads`) + `serverActions.bodySizeLimit: "5mb"`؛ نماذج الادمن (طبق/صنف) أصبحت `type="file"` بدل روابط، مع معاينة عند التعديل.
- [x] **M12 أصناف بمكونات إلزامية وصفحات مستقلة** — لوحة الادمن أصبحت شبكة أصناف → `/admin/categories/[slug]` لكل صنف (صورة + أطباق + مكونات)؛ أقسام منفصلة للأساسية/الإضافات؛ `isRequired` يمنع إزالة المكون لدى الزبون (🔒) ويُستثنى من `removedList`.
- [x] **M13 نافذة تخصيص أوسع وأوضح** — `ProductCustomizer` من `max-w-lg` إلى `max-w-2xl`؛ قسم أساسية/إضافات جنباً إلى جنب على الشاشات ≥sm (شبكة شرطية عند وجود القسمين فقط)؛ شرائح/صفوف/عناوين/إجمالي أكبر؛ بلا تغيير في منطق التخصيص.
- [x] **M14 نشر حقيقي: GitHub + Turso + Vercel** — المستودع على GitHub (`oubchirmohamedsaid-code/restaurant-menu`، فرع `main`، 46 ملفاً)؛ قاعدة Turso `restaurant-menu` (URL+Token في `.env` المحلي فقط، gitignored)؛ تُحقّق Turso باختبار HTTP كامل (كل المسارات 200) وسموك خضراء؛ الخطوة الأخيرة: ربط Vercel بالمتغيرات الأربعة ثم Deploy.
- [ ] **ربط Vercel** — استيراد المستودع من GitHub → إضافة `TURSO_URL` + `TURSO_TOKEN` + `ADMIN_PASSWORD` + `SESSION_SECRET` → Deploy → تحقق HTTP للرابط الحي.
- [ ] صور المنتجات المبدئية من `images.unsplash.com` (مخاطرة Hotlinking) — الادمن يستبدلها برابطه؛ **رفع ملفات خارج النطاق** (معيار متفق عليه).
- [ ] CRUD للأصناف نفسها — **خارج النطاق** عمداً (الأصناف مُزرعة وثابتة؛ يُعدّل رابط صورتها فقط).
- [ ] حالة/عرض وتأكيد الطلب من الزبون أو حالة (جديد/مكتمل) في الادمن — **خارج النطاق** حالياً (الطلبات مخزّنة تُعرض وتُحذف فقط).

### سجل القرارات (Decisions Log)
- **DB = `node:sqlite`** بدل Prisma 7 (better-sqlite3 بلا prebuild على Node24/win32؛ صفر تبعيات أصلية).
- **صفحات المنيو `force-dynamic`** لضمان انعكاس فوري لتعديلات الادمن.
- **رابط `الإدارة`** في الترويسة للوصول إلى `/admin` (زر 🔒).
- **فحص HTTP للـ auth** عبر `curl` (التحقق بـ PowerShell ضلّل باتباع إعادة التوجيه).
- **مكوّنات الطبق**: الأساسية سعرها 0 (مشمولة) والإزالة لا تُغيّر السعر؛ الإضافات لها سعر يُضاف. يُعاد حساب السعر **خادمياً** عند الطلب (لا يُؤتمن سعر العميل) مع التحقق من انتماء الإضافات للمنتج.
- **الطلبات بلا واتساب**: `NEXT_PUBLIC_WHATSAPP` و`buildOrderText` وزر «واتساب» أُزيلوا؛ الطلبات تُخزّن في `orders` وتظهر في `/admin/orders`.
- **هوية سطر السلة**: `CartLine.key` فريد (منتج + ترتيب الإضافات/المحذوفات) كي لا تندمج التخصيصات المختلفة؛ مفتاح localStorage ارتُقي إلى `menu_cart_v2`.
- **صور الأصناف**: `Category.imageUrl` عبر ترحيل `ALTER TABLE ADD COLUMN` عند الإقلاع للقواعد القائمة (idempotent).
- **العملة**: دج افتراضياً وقابلة للتغيير عبر `CURRENCY` في `.env`.
- **رفع الصور محلياً**: `saveImageUpload` يتحقق من الصيغة (jpeg/png/webp/gif) والحجم (≤4MB) ويحفظ باسم فريد في `public/uploads`؛ `bodySizeLimit` في next.config ليتسع لنقل ملفات النماذج.
- **المكون الإلزامي**: `isRequired` يقفل إزالة المكون في نافذة الزبون (disabled + 🔒) ويستبعد الإضافة قسرياً من `removedList`؛ لا يُطبّق سعر (الرئيسية مشمولة دائماً).
- **صفحات الأصناف الادمن**: `/admin/dashboard` مجرد شبكة بطاقات؛ كل صنف له صفحته `/admin/categories/[slug]` كي تنمو أقسام كل صنف دون ازدحام صفحة واحدة.
- **Turso/Vercel**: `node:sqlite` مدمج يعمل محلياً فقط (ملف) ولا يعمل على Vercel؛ لذلك أُضيفت طبقة `@libsql/client` (async) مع `getDb()` يقرر تلقائياً بناءً على `TURSO_URL`. كل الدوال/السكربتات تحوّلت إلى async بواجهة واحدة؛ السكربتات داخل `async main()`. النشر على Vercel يحتاج `TURSO_URL` + `TURSO_TOKEN` (+ `ADMIN_PASSWORD` + `SESSION_SECRET`) في متغيرات البيئة.
