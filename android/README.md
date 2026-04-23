# تقويم — مشروع Android مع ويدجت كلاسيكي

مشروع Android أصلي يحتوي على:

- **تطبيق رئيسي** (`MainActivity`) يفتح الموقع `https://12mohsen.github.io/calendar1/` داخل WebView.
- **ويدجت كلاسيكي 1×1** (`CalendarWidgetProvider`) يظهر على الشاشة الرئيسية كأيقونة تقويم، يعرض:
  - **اسم الشهر الهجري** (شوال، رمضان…) في شريط علوي أحمر.
  - **رقم اليوم الهجري** بأرقام عربية (حساب أم القرى).
- **تحديث تلقائي** كل ليلة عند منتصف الليل (`AlarmManager`) + استجابة لـ `ACTION_DATE_CHANGED` / `BOOT_COMPLETED`.
- **النقر على الويدجت** يفتح `MainActivity`.

## كيف تبني التطبيق (APK)

1. نزّل وثبّت **Android Studio** من https://developer.android.com/studio
2. من داخل Android Studio: `File → Open` ثم اختر مجلد `android/` هذا.
3. انتظر حتى يكتمل Gradle Sync (قد يستغرق عدة دقائق أول مرة لتحميل الإعتماديات).
4. اختر `Build → Build Bundle(s) / APK(s) → Build APK(s)`.
5. ستجد الملف في `app/build/outputs/apk/debug/app-debug.apk`.
6. انسخه على الهاتف وثبته (بعد تفعيل "تثبيت من مصادر غير معروفة").

## كيف تضيف الويدجت

1. بعد تثبيت التطبيق، اضغط مطوّلاً على مكان فارغ في الشاشة الرئيسية.
2. اختر **Widgets / الودجات**.
3. ابحث عن **تقويم** واسحبه إلى الشاشة.
4. سيظهر بحجم 1×1 كأيقونة بيضاء عليها الشهر الهجري ورقم اليوم.

## الحد الأدنى

- **minSdk = 26** (Android 8.0 Oreo فما فوق) — يغطي ~98٪ من الأجهزة النشطة.
- **targetSdk / compileSdk = 34** (Android 14).

## تخصيص

- **رابط الموقع**: في `MainActivity.kt` عدّل `APP_URL`.
- **اسم الحزمة** (`com.mohsen.calendar`): غيّره في `app/build.gradle` + مسار المجلدات + `AndroidManifest`.
- **ألوان الويدجت**: `res/drawable/widget_bg.xml` و `widget_top_bar.xml`.
- **تخطيط الويدجت**: `res/layout/widget_calendar.xml`.

## بنية المشروع

```
android/
├── build.gradle          (root)
├── settings.gradle
├── gradle.properties
└── app/
    ├── build.gradle
    ├── proguard-rules.pro
    └── src/main/
        ├── AndroidManifest.xml
        ├── java/com/mohsen/calendar/
        │   ├── MainActivity.kt
        │   └── CalendarWidgetProvider.kt
        └── res/
            ├── drawable/  (widget_bg, widget_top_bar, ic_launcher_*)
            ├── layout/    (activity_main, widget_calendar)
            ├── mipmap-anydpi-v26/ (ic_launcher, ic_launcher_round)
            ├── values/    (strings, themes)
            └── xml/       (widget_info)
```

## ملاحظات تقنية

- **حساب التقويم الهجري**: يستخدم `android.icu.util.IslamicCalendar` مع `ISLAMIC_UMALQURA` (التقويم الرسمي في السعودية).
- **التحديث عند منتصف الليل**: يُستخدم `AlarmManager.set(RTC, ...)` (غير دقيق) لأننا لا نحتاج دقة ثواني، ولا يحتاج إذن `SCHEDULE_EXACT_ALARM`.
- **استعادة بعد إعادة التشغيل**: `ACTION_BOOT_COMPLETED` مُسجّل في الـ manifest لإعادة جدولة المنبه بعد إقلاع الهاتف.
