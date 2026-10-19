package expo.modules.chrpwidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.text.format.DateFormat
import android.text.format.DateUtils
import android.view.View
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// Android Home Screen widget: the next game, the player's answer, and
// In / Maybe / Out buttons that save without opening the app. Mirrors
// ios/ChrpWidget/ChrpWidget.swift and talks to the same widgetApi function.
class ChrpWidgetProvider : AppWidgetProvider() {

  override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
    val pending = goAsync()
    Thread {
      try {
        val state = WidgetStore.fetchState(context)
        render(context, state, WidgetStore.recentlyFailed(context))
      } finally {
        pending.finish()
      }
    }.start()
  }

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION_RESPOND) {
      super.onReceive(context, intent)
      return
    }
    val eventId = intent.getStringExtra(EXTRA_EVENT_ID) ?: return
    val response = intent.getStringExtra(EXTRA_RESPONSE) ?: return
    val pending = goAsync()
    Thread {
      try {
        val previous = WidgetStore.snapshotCache(context)
        WidgetStore.applyOptimistic(context, eventId, response)
        render(context, WidgetStore.cachedState(context), false)
        val state = WidgetStore.respond(context, eventId, response, previous)
        render(context, state, WidgetStore.recentlyFailed(context))
      } finally {
        pending.finish()
      }
    }.start()
  }

  companion object {
    private const val ACTION_RESPOND = "expo.modules.chrpwidget.RESPOND"
    private const val EXTRA_EVENT_ID = "eventId"
    private const val EXTRA_RESPONSE = "response"

    private const val GREEN = 0xFF22C55E.toInt()
    private const val AMBER = 0xFFF59E0B.toInt()
    private const val RED = 0xFFEF4444.toInt()
    private const val STATUS_GREEN = 0xFF4ADE80.toInt()
    private const val STATUS_AMBER = 0xFFFBBF24.toInt()
    private const val STATUS_RED = 0xFFF87171.toInt()

    private fun widgetIds(context: Context): IntArray =
      AppWidgetManager.getInstance(context)
        .getAppWidgetIds(ComponentName(context, ChrpWidgetProvider::class.java))

    // Called by the app (via ChrpWidgetModule) whenever the account, team or an
    // answer changes. Re-runs onUpdate, which fetches fresh data.
    fun refreshAll(context: Context) {
      val ids = widgetIds(context)
      if (ids.isEmpty()) return
      val intent = Intent(context, ChrpWidgetProvider::class.java)
        .setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
        .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
      context.sendBroadcast(intent)
    }

    private fun render(context: Context, state: WidgetStore.State, saveFailed: Boolean) {
      val ids = widgetIds(context)
      if (ids.isEmpty()) return
      val views = RemoteViews(context.packageName, R.layout.chrp_widget)

      // Tapping anywhere but a button opens the app.
      context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { launch ->
        val open = PendingIntent.getActivity(
          context, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        views.setOnClickPendingIntent(android.R.id.background, open)
      }

      when (state) {
        is WidgetStore.State.NeedsSetup ->
          showMessage(views, "CHRP", "Open Chrp once to see your next game here.")
        is WidgetStore.State.NeedsReconnect ->
          showMessage(views, "CHRP", "Open Chrp to reconnect this widget.")
        is WidgetStore.State.Offline ->
          showMessage(views, "CHRP", "Can't reach Chrp right now. We'll try again soon.")
        is WidgetStore.State.Ready -> {
          val event = state.payload.event
          views.setTextViewText(R.id.chrp_team, state.payload.teamName.uppercase(Locale.getDefault()))
          views.setTextColor(R.id.chrp_dot, parseColor(state.payload.teamColor))
          if (event == null) {
            showMessage(views, state.payload.teamName.uppercase(Locale.getDefault()), "No upcoming games scheduled.")
          } else {
            showEvent(context, views, event, state.stale, saveFailed)
          }
        }
      }

      AppWidgetManager.getInstance(context).updateAppWidget(ids, views)
    }

    private fun showMessage(views: RemoteViews, team: String, message: String) {
      views.setTextViewText(R.id.chrp_team, team)
      views.setTextViewText(R.id.chrp_message, message)
      views.setViewVisibility(R.id.chrp_message, View.VISIBLE)
      views.setViewVisibility(R.id.chrp_event, View.GONE)
    }

    private fun showEvent(
      context: Context,
      views: RemoteViews,
      event: WidgetStore.Event,
      stale: Boolean,
      saveFailed: Boolean,
    ) {
      views.setViewVisibility(R.id.chrp_message, View.GONE)
      views.setViewVisibility(R.id.chrp_event, View.VISIBLE)
      views.setTextViewText(R.id.chrp_title, event.title)
      views.setTextViewText(R.id.chrp_when, whenLine(context, event.startsAt))
      views.setTextViewText(R.id.chrp_venue, event.venue)
      views.setViewVisibility(R.id.chrp_venue, if (event.venue.isEmpty()) View.GONE else View.VISIBLE)

      val answer = when (event.response) {
        "in" -> if (event.autoIn) "You're in (auto)" else "You're in"
        "maybe" -> "You're a maybe"
        "out" -> "You're out"
        else -> "Are you in?"
      }
      val status = when {
        saveFailed -> "Couldn't save. Try again."
        stale -> "$answer · offline"
        else -> answer
      }
      views.setTextViewText(R.id.chrp_status, status)
      views.setTextColor(
        R.id.chrp_status,
        when {
          saveFailed -> STATUS_RED
          event.response == "in" -> STATUS_GREEN
          event.response == "maybe" -> STATUS_AMBER
          event.response == "out" -> STATUS_RED
          else -> Color.WHITE
        },
      )

      button(context, views, R.id.chrp_btn_in, event, "in", GREEN, R.drawable.chrp_btn_in_on, R.drawable.chrp_btn_in_off, 1)
      button(context, views, R.id.chrp_btn_maybe, event, "maybe", AMBER, R.drawable.chrp_btn_maybe_on, R.drawable.chrp_btn_maybe_off, 2)
      button(context, views, R.id.chrp_btn_out, event, "out", RED, R.drawable.chrp_btn_out_on, R.drawable.chrp_btn_out_off, 3)
    }

    private fun button(
      context: Context,
      views: RemoteViews,
      viewId: Int,
      event: WidgetStore.Event,
      value: String,
      tint: Int,
      onBackground: Int,
      offBackground: Int,
      requestCode: Int,
    ) {
      val selected = event.response == value
      views.setInt(viewId, "setBackgroundResource", if (selected) onBackground else offBackground)
      views.setTextColor(viewId, if (selected) Color.BLACK else tint)
      val intent = Intent(context, ChrpWidgetProvider::class.java)
        .setAction(ACTION_RESPOND)
        .putExtra(EXTRA_EVENT_ID, event.eventId)
        .putExtra(EXTRA_RESPONSE, value)
      val tap = PendingIntent.getBroadcast(
        context, requestCode, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )
      views.setOnClickPendingIntent(viewId, tap)
    }

    private fun whenLine(context: Context, startsAt: Long): String {
      val start = Date(startsAt)
      val time = DateFormat.getTimeFormat(context).format(start)
      val day = when {
        DateUtils.isToday(startsAt) -> "Today"
        DateUtils.isToday(startsAt - DateUtils.DAY_IN_MILLIS) -> "Tomorrow"
        else -> SimpleDateFormat("EEE, MMM d", Locale.getDefault()).format(start)
      }
      return "$day · $time"
    }

    private fun parseColor(hex: String): Int = try {
      Color.parseColor(hex)
    } catch (e: IllegalArgumentException) {
      0xFF2540D6.toInt()
    }
  }
}
