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
    when (intent.action) {
      // ‹ › and the team switch only re-read the cache: instant, and offline too.
      ACTION_PREV, ACTION_NEXT, ACTION_CYCLE_TEAM -> {
        when (intent.action) {
          ACTION_PREV -> WidgetStore.page(context, -1)
          ACTION_NEXT -> WidgetStore.page(context, 1)
          else -> WidgetStore.cycleTeam(context)
        }
        render(context, WidgetStore.cachedState(context), WidgetStore.recentlyFailed(context))
      }
      ACTION_RESPOND -> {
        val eventId = intent.getStringExtra(EXTRA_EVENT_ID) ?: return
        val response = intent.getStringExtra(EXTRA_RESPONSE) ?: return
        val teamId = intent.getStringExtra(EXTRA_TEAM_ID)
        val pending = goAsync()
        Thread {
          try {
            val previous = WidgetStore.snapshotCache(context)
            WidgetStore.applyOptimistic(context, eventId, response)
            render(context, WidgetStore.cachedState(context), false)
            val state = WidgetStore.respond(context, teamId, eventId, response, previous)
            render(context, state, WidgetStore.recentlyFailed(context))
          } finally {
            pending.finish()
          }
        }.start()
      }
      else -> super.onReceive(context, intent)
    }
  }

  companion object {
    private const val ACTION_RESPOND = "expo.modules.chrpwidget.RESPOND"
    private const val ACTION_PREV = "expo.modules.chrpwidget.PREV"
    private const val ACTION_NEXT = "expo.modules.chrpwidget.NEXT"
    private const val ACTION_CYCLE_TEAM = "expo.modules.chrpwidget.CYCLE_TEAM"
    private const val EXTRA_TEAM_ID = "teamId"
    private const val EXTRA_EVENT_ID = "eventId"
    private const val EXTRA_RESPONSE = "response"

    private const val GREEN = 0xFF22C55E.toInt()
    private const val AMBER = 0xFFF59E0B.toInt()
    private const val RED = 0xFFEF4444.toInt()
    private const val STATUS_GREEN = 0xFF4ADE80.toInt()
    private const val STATUS_AMBER = 0xFFFBBF24.toInt()
    private const val STATUS_RED = 0xFFF87171.toInt()
    private const val ARROW_ON = 0xE6FFFFFF.toInt()
    private const val ARROW_OFF = 0x40FFFFFF

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

      views.setViewVisibility(R.id.chrp_prev, View.GONE)
      views.setViewVisibility(R.id.chrp_pos, View.GONE)
      views.setViewVisibility(R.id.chrp_next, View.GONE)
      views.setTextColor(R.id.chrp_dot, parseColor("#2540D6"))

      when (state) {
        is WidgetStore.State.NeedsSetup ->
          showMessage(views, "CHRP", "Open Chrp once to see your next game here.")
        is WidgetStore.State.NeedsReconnect ->
          showMessage(views, "CHRP", "Open Chrp to reconnect this widget.")
        is WidgetStore.State.Offline ->
          showMessage(views, "CHRP", "Can't reach Chrp right now. We'll try again soon.")
        is WidgetStore.State.Ready -> {
          val sel = WidgetStore.selection(context, state.payload)
          header(context, views, sel)
          val event = sel.event
          if (event == null) {
            showMessage(
              views,
              teamLabel(sel),
              if (sel.filteringOneTeam) "No upcoming games for this team." else "No upcoming games scheduled.",
            )
          } else {
            showEvent(context, views, sel, event, state.stale, saveFailed)
          }
        }
      }

      AppWidgetManager.getInstance(context).updateAppWidget(ids, views)
    }

    private fun teamLabel(sel: WidgetStore.Selection): String {
      val name = sel.filterLabel.uppercase(Locale.getDefault())
      return if (sel.canCycleTeams) "$name  ⇄" else name
    }

    private fun broadcast(context: Context, action: String, requestCode: Int): PendingIntent =
      PendingIntent.getBroadcast(
        context,
        requestCode,
        Intent(context, ChrpWidgetProvider::class.java).setAction(action),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )

    private fun header(context: Context, views: RemoteViews, sel: WidgetStore.Selection) {
      views.setTextViewText(R.id.chrp_team, teamLabel(sel))
      views.setTextColor(R.id.chrp_dot, parseColor(sel.filterColor))
      if (sel.canCycleTeams) {
        views.setOnClickPendingIntent(R.id.chrp_team_chip, broadcast(context, ACTION_CYCLE_TEAM, 10))
      }
      if (sel.count > 1) {
        views.setViewVisibility(R.id.chrp_prev, View.VISIBLE)
        views.setViewVisibility(R.id.chrp_pos, View.VISIBLE)
        views.setViewVisibility(R.id.chrp_next, View.VISIBLE)
        views.setTextViewText(R.id.chrp_pos, "${sel.index + 1}/${sel.count}")
        views.setTextColor(R.id.chrp_prev, if (sel.index > 0) ARROW_ON else ARROW_OFF)
        views.setTextColor(R.id.chrp_next, if (sel.index < sel.count - 1) ARROW_ON else ARROW_OFF)
        views.setOnClickPendingIntent(R.id.chrp_prev, broadcast(context, ACTION_PREV, 11))
        views.setOnClickPendingIntent(R.id.chrp_next, broadcast(context, ACTION_NEXT, 12))
      }
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
      sel: WidgetStore.Selection,
      event: WidgetStore.Event,
      stale: Boolean,
      saveFailed: Boolean,
    ) {
      views.setViewVisibility(R.id.chrp_message, View.GONE)
      views.setViewVisibility(R.id.chrp_event, View.VISIBLE)
      val eventTeam = sel.eventTeam
      if (sel.showTeamOnEvent && eventTeam != null) {
        views.setViewVisibility(R.id.chrp_event_team, View.VISIBLE)
        views.setTextViewText(R.id.chrp_event_team, eventTeam.teamName.uppercase(Locale.getDefault()))
        views.setTextColor(R.id.chrp_event_team, parseColor(eventTeam.teamColor))
      } else {
        views.setViewVisibility(R.id.chrp_event_team, View.GONE)
      }
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
        .putExtra(EXTRA_TEAM_ID, event.teamId)
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
