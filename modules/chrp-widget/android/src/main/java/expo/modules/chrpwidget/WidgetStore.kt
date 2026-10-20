package expo.modules.chrpwidget

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.SecureRandom

// Android counterpart of ios/ChrpWidget/Shared.swift. The app writes the config
// (who to fetch for, and the per-device key the widgetApi function checks); the
// widget fetches upcoming games itself, so it stays current without the app.
internal object WidgetStore {
  private const val PREFS = "chrp_widget"
  private const val CONFIG = "config"
  private const val CACHE = "cache"
  private const val DEVICE_KEY = "deviceKey"
  private const val FAILED_AT = "failedAt"
  private const val LAST_FETCH_OK = "lastFetchOk"
  private const val TEAM_FILTER = "teamFilter"
  private const val INDEX = "index"
  private const val ALL_TEAMS = "all"
  private const val DEFAULT_API = "https://northamerica-northeast1-chrp-app.cloudfunctions.net/widgetApi"

  data class Config(val uid: String, val key: String, val teamId: String, val apiUrl: String)

  data class Team(val teamId: String, val teamName: String, val teamColor: String)

  data class Event(
    val teamId: String?,
    val eventId: String,
    val title: String,
    val venue: String,
    val startsAt: Long,
    val response: String?,
    val autoIn: Boolean,
  )

  data class Payload(val teams: List<Team>, val events: List<Event>) {
    fun team(event: Event): Team? =
      teams.firstOrNull { it.teamId == event.teamId } ?: if (teams.size == 1) teams[0] else null
  }

  // What the widget shows right now: the chosen team filter and position.
  data class Selection(
    val event: Event?,
    val eventTeam: Team?,
    val index: Int,
    val count: Int,
    val filterLabel: String,
    val filterColor: String,
    val canCycleTeams: Boolean,
    val showTeamOnEvent: Boolean,
    val filteringOneTeam: Boolean,
  )

  sealed class State {
    object NeedsSetup : State()      // app never opened, or signed out
    object NeedsReconnect : State()  // key or membership rejected
    object Offline : State()         // no network and nothing usable cached
    data class Ready(val payload: Payload, val stale: Boolean) : State()
  }

  private class ApiException(val status: Int) : Exception("HTTP $status")

  private fun prefs(c: Context) = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun deviceKey(c: Context): String {
    val existing = prefs(c).getString(DEVICE_KEY, null)
    if (!existing.isNullOrEmpty()) return existing
    val bytes = ByteArray(32)
    SecureRandom().nextBytes(bytes)
    val key = bytes.joinToString("") { String.format("%02x", it.toInt() and 0xff) }
    prefs(c).edit().putString(DEVICE_KEY, key).apply()
    return key
  }

  fun setConfig(c: Context, json: String) {
    val previous = prefs(c).getString(CONFIG, null)
    val edit = prefs(c).edit().putString(CONFIG, json)
    // Another player or team: whatever was cached belongs to someone else.
    if (previous != json) edit.remove(CACHE)
    edit.apply()
  }

  fun clear(c: Context) {
    prefs(c).edit().remove(CONFIG).remove(CACHE).remove(TEAM_FILTER).remove(INDEX).apply()
  }

  private fun config(c: Context): Config? {
    val raw = prefs(c).getString(CONFIG, null) ?: return null
    return try {
      val o = JSONObject(raw)
      val api = o.optString("apiUrl", "")
      Config(o.getString("uid"), o.getString("key"), o.getString("teamId"), if (api.isEmpty()) DEFAULT_API else api)
    } catch (e: Exception) {
      null
    }
  }

  private fun parseEvent(e: JSONObject) = Event(
    teamId = if (e.isNull("teamId")) null else e.optString("teamId"),
    eventId = e.getString("eventId"),
    title = e.optString("title", "Game"),
    venue = e.optString("venue", ""),
    startsAt = e.getLong("startsAt"),
    response = if (e.isNull("response")) null else e.optString("response"),
    autoIn = e.optBoolean("autoIn", false),
  )

  // Reads both the multi-team payload and the older single-game one.
  private fun parse(json: String): Payload {
    val o = JSONObject(json)
    val teams = mutableListOf<Team>()
    o.optJSONArray("teams")?.let { arr ->
      for (i in 0 until arr.length()) {
        val t = arr.getJSONObject(i)
        teams.add(Team(t.getString("teamId"), t.optString("teamName", "Your team"), t.optString("teamColor", "#2540D6")))
      }
    }
    val events = mutableListOf<Event>()
    val arr = o.optJSONArray("events")
    if (arr != null) {
      for (i in 0 until arr.length()) events.add(parseEvent(arr.getJSONObject(i)))
    } else {
      o.optJSONObject("event")?.let { events.add(parseEvent(it)) }
    }
    if (teams.isEmpty()) {
      teams.add(Team(events.firstOrNull()?.teamId ?: "", o.optString("teamName", "Your team"), o.optString("teamColor", "#2540D6")))
    }
    return Payload(teams, events)
  }

  private fun cachedJson(c: Context): String? = prefs(c).getString(CACHE, null)

  private fun saveCache(c: Context, json: String) {
    prefs(c).edit().putString(CACHE, json).apply()
  }

  // True for two minutes after a reply could not be saved.
  fun recentlyFailed(c: Context): Boolean =
    System.currentTimeMillis() - prefs(c).getLong(FAILED_AT, 0L) < 120_000L

  private fun call(cfg: Config, action: String, teamId: String? = null, eventId: String? = null, response: String? = null): String {
    val body = JSONObject()
      .put("uid", cfg.uid)
      .put("key", cfg.key)
      .put("teamId", teamId ?: cfg.teamId)
      .put("action", action)
    if (eventId != null) body.put("eventId", eventId)
    if (response != null) body.put("response", response)

    val conn = URL(cfg.apiUrl).openConnection() as HttpURLConnection
    try {
      conn.requestMethod = "POST"
      conn.connectTimeout = 5_000
      conn.readTimeout = 6_000
      conn.doOutput = true
      conn.setRequestProperty("Content-Type", "application/json")
      conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
      val code = conn.responseCode
      if (code != 200) throw ApiException(code)
      return conn.inputStream.bufferedReader().use { it.readText() }
    } finally {
      conn.disconnect()
    }
  }

  // Last known data, without touching the network. Games that have started
  // are dropped. "stale" when the last network attempt failed.
  fun cachedState(c: Context): State {
    if (config(c) == null) return State.NeedsSetup
    val json = cachedJson(c) ?: return State.Offline
    return try {
      val payload = parse(json)
      val now = System.currentTimeMillis()
      val upcoming = payload.events.filter { it.startsAt > now }
      if (upcoming.isEmpty() && payload.events.isNotEmpty() && !prefs(c).getBoolean(LAST_FETCH_OK, false)) {
        State.Offline
      } else {
        State.Ready(payload.copy(events = upcoming), stale = !prefs(c).getBoolean(LAST_FETCH_OK, false))
      }
    } catch (e: Exception) {
      State.Offline
    }
  }

  fun fetchState(c: Context): State {
    val cfg = config(c) ?: return State.NeedsSetup
    return try {
      val json = call(cfg, "fetch")
      saveCache(c, json)
      prefs(c).edit().putBoolean(LAST_FETCH_OK, true).apply()
      State.Ready(parse(json), stale = false)
    } catch (e: ApiException) {
      if (e.status == 403) State.NeedsReconnect else markFailedFetch(c)
    } catch (e: Exception) {
      markFailedFetch(c)
    }
  }

  private fun markFailedFetch(c: Context): State {
    prefs(c).edit().putBoolean(LAST_FETCH_OK, false).apply()
    return cachedState(c)
  }

  // ─── Filter and position ──────────────────────────────────────────────────

  fun selection(c: Context, payload: Payload): Selection {
    val teams = payload.teams
    val canCycle = teams.size > 1
    var filter = prefs(c).getString(TEAM_FILTER, ALL_TEAMS) ?: ALL_TEAMS
    if (filter != ALL_TEAMS && teams.none { it.teamId == filter }) filter = ALL_TEAMS // left that team
    val events = payload.events.filter { filter == ALL_TEAMS || it.teamId == filter }
    val stored = prefs(c).getInt(INDEX, 0)
    val index = if (events.isEmpty()) 0 else stored.coerceIn(0, events.size - 1)
    val event = events.getOrNull(index)
    val filterTeam = teams.firstOrNull { it.teamId == filter }

    val label: String
    val color: String
    when {
      !canCycle -> {
        label = teams.firstOrNull()?.teamName ?: "Your team"
        color = teams.firstOrNull()?.teamColor ?: "#2540D6"
      }
      filterTeam != null -> {
        label = filterTeam.teamName
        color = filterTeam.teamColor
      }
      else -> {
        label = "All teams"
        color = event?.let { payload.team(it)?.teamColor } ?: "#2540D6"
      }
    }
    return Selection(
      event = event,
      eventTeam = event?.let { payload.team(it) },
      index = index,
      count = events.size,
      filterLabel = label,
      filterColor = color,
      canCycleTeams = canCycle,
      showTeamOnEvent = canCycle && filterTeam == null,
      filteringOneTeam = canCycle && filterTeam != null,
    )
  }

  fun page(c: Context, delta: Int) {
    val state = cachedState(c)
    if (state !is State.Ready) return
    val current = selection(c, state.payload)
    if (current.count == 0) return
    prefs(c).edit().putInt(INDEX, (current.index + delta).coerceIn(0, current.count - 1)).apply()
  }

  fun cycleTeam(c: Context) {
    val state = cachedState(c)
    if (state !is State.Ready) return
    val order = listOf(ALL_TEAMS) + state.payload.teams.map { it.teamId }
    val current = prefs(c).getString(TEAM_FILTER, ALL_TEAMS) ?: ALL_TEAMS
    val position = order.indexOf(current).coerceAtLeast(0)
    prefs(c).edit().putString(TEAM_FILTER, order[(position + 1) % order.size]).putInt(INDEX, 0).apply()
  }

  // ─── Answering ────────────────────────────────────────────────────────────

  // Shows the tap at once; the answer from the server replaces it, or the old
  // answer is put back if the save failed.
  fun applyOptimistic(c: Context, eventId: String, response: String) {
    val json = cachedJson(c) ?: return
    try {
      val o = JSONObject(json)
      fun mark(e: JSONObject?) {
        if (e != null && e.optString("eventId") == eventId) {
          e.put("response", response)
          e.put("autoIn", false)
        }
      }
      mark(o.optJSONObject("event"))
      val arr: JSONArray? = o.optJSONArray("events")
      if (arr != null) for (i in 0 until arr.length()) mark(arr.optJSONObject(i))
      saveCache(c, o.toString())
    } catch (e: Exception) {
      // Leave the cache as it was.
    }
  }

  fun respond(c: Context, teamId: String?, eventId: String, response: String, previousJson: String?): State {
    val cfg = config(c) ?: return State.NeedsSetup
    return try {
      val json = call(cfg, "respond", teamId, eventId, response)
      saveCache(c, json)
      prefs(c).edit().remove(FAILED_AT).putBoolean(LAST_FETCH_OK, true).apply()
      State.Ready(parse(json), stale = false)
    } catch (e: Exception) {
      if (previousJson != null) saveCache(c, previousJson)
      prefs(c).edit().putLong(FAILED_AT, System.currentTimeMillis()).apply()
      if (e is ApiException && e.status == 403) State.NeedsReconnect else cachedState(c)
    }
  }

  fun snapshotCache(c: Context): String? = cachedJson(c)
}
