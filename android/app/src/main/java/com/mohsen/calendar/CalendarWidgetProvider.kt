package com.mohsen.calendar

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.icu.util.IslamicCalendar
import android.os.Build
import android.widget.RemoteViews
import java.util.Calendar

class CalendarWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (id in appWidgetIds) updateWidget(context, appWidgetManager, id)
        scheduleMidnightUpdate(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            Intent.ACTION_DATE_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_BOOT_COMPLETED,
            ACTION_MIDNIGHT_UPDATE -> {
                val mgr = AppWidgetManager.getInstance(context)
                val component = ComponentName(context, CalendarWidgetProvider::class.java)
                val ids = mgr.getAppWidgetIds(component)
                for (id in ids) updateWidget(context, mgr, id)
                scheduleMidnightUpdate(context)
            }
        }
    }

    override fun onEnabled(context: Context) {
        scheduleMidnightUpdate(context)
    }

    override fun onDisabled(context: Context) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(midnightPendingIntent(context))
    }

    private fun updateWidget(
        context: Context,
        mgr: AppWidgetManager,
        widgetId: Int
    ) {
        val hijri = IslamicCalendar().apply {
            calculationType = IslamicCalendar.CalculationType.ISLAMIC_UMALQURA
            timeInMillis = System.currentTimeMillis()
        }
        val day = hijri.get(Calendar.DAY_OF_MONTH)
        val month = hijri.get(Calendar.MONTH)
        val monthName = HIJRI_MONTHS.getOrNull(month) ?: "-"

        val views = RemoteViews(context.packageName, R.layout.widget_calendar)
        views.setTextViewText(R.id.widget_day, toArabicDigits(day))
        views.setTextViewText(R.id.widget_month, monthName)

        val launch = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val piFlags = PendingIntent.FLAG_UPDATE_CURRENT or
                (if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0)
        val pi = PendingIntent.getActivity(context, 0, launch, piFlags)
        views.setOnClickPendingIntent(R.id.widget_root, pi)

        mgr.updateAppWidget(widgetId, views)
    }

    private fun scheduleMidnightUpdate(context: Context) {
        val next = Calendar.getInstance().apply {
            add(Calendar.DAY_OF_YEAR, 1)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 2)
            set(Calendar.MILLISECOND, 0)
        }
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.set(AlarmManager.RTC, next.timeInMillis, midnightPendingIntent(context))
    }

    private fun midnightPendingIntent(context: Context): PendingIntent {
        val intent = Intent(context, CalendarWidgetProvider::class.java).apply {
            action = ACTION_MIDNIGHT_UPDATE
        }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                (if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0)
        return PendingIntent.getBroadcast(context, 1001, intent, flags)
    }

    private fun toArabicDigits(n: Int): String {
        val digits = charArrayOf('٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩')
        return n.toString().map { digits[it.digitToInt()] }.joinToString("")
    }

    companion object {
        const val ACTION_MIDNIGHT_UPDATE = "com.mohsen.calendar.ACTION_MIDNIGHT_UPDATE"
        val HIJRI_MONTHS = arrayOf(
            "محرم", "صفر", "ربيع الأول", "ربيع الآخر",
            "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان",
            "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
        )
    }
}
