package expo.modules.chrpwidget

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.SecureRandom

// Android counterpart of ios/ChrpWidget/Shared.swift. The app writes the config
// (who to fetch for, and the per-device key the widgetApi function checks); the
// widget fetches the next game itself, so it stays current without the app.
internal object WidgetStore {
  private const val PREFS = "chrp_widget"
  private const val CONFIG = "config"
  private const val CACHE = "cache"
  private const val DEVICE_KEY = "deviceKey"
  private const val FAILED_AT = "failedAt"
  private const val DEFAULT_API = "https://northamerica-northeast1-chrp-app.cloudfunctions.net/widgetApi"

  data class Config(val uid: String, val key: String, val teamId: String, val apiUrl: String)

  data class Event(
    val eventId: String,
    val title: String,
    val venue: String,
    val startsAt: Long,
    val response: String?,
    val autoIn: Boolean,
  )

  data class Payload(val teamName: String, val teamColor: String, val event: Event?)

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
    prefs(c).edit().remove(CONFIG).remove(CACHE).apply()
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

  private fun parse(json: String): Payload {
    val o = JSONObject(json)
    val e = o.optJSONObject("event")
    val event = if (e == null) null else Event(
      eventId = e.getString("eventId"),
      title = e.optString("title", "Game"),
      venue = e.optString("venue", ""),
      startsAt = e.getLong("startsAt"),
      response = if (e.isNull("response")) null else e.optString("response"),
      autoIn = e.optBoolean("autoIn", false),
    )
    return Payload(o.optString("teamName", "Your team"), o.optString("teamColor", "#2540D6"), event)
  }

  private fun cachedJson(c: Context): String? = prefs(c).getString(CACHE, null)

  private fun saveCache(c: Context, json: String) {
    prefs(c).edit().putString(CACHE, json).apply()
  }

  // True for two minutes after a reply could not be saved.
  fun recentlyFailed(c: Context): Boolean =
    System.currentTimeMillis() - prefs(c).getLong(FAILED_AT, 0L) < 120_000L

  private fun call(cfg: Config, action: String, eventId: String? = null, response: String? = null): String {
    val body = JSONObject()
      .put("uid", cfg.uid)
      .put("key", cfg.key)
      .put("teamId", cfg.teamId)
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

  // Last known data, without touching the network. Never shows a game that
  // has already started.
  fun cachedState(c: Context): State {
    if (config(c) == null) return State.NeedsSetup
    val json = cachedJson(c) ?: return State.Offline
    return try {
      val payload = parse(json)
      val event = payload.event
      if (event != null && event.startsAt <= System.currentTimeMillis()) State.Offline
      else State.Ready(payload, stale = true)
    } catch (e: Exception) {
      State.Offline
    }
  }

  fun fetchState(c: Context): State {
    val cfg = config(c) ?: return State.NeedsSetup
    return try {
      val json = call(cfg, "fetch")
      saveCache(c, json)
      State.Ready(parse(json), stale = false)
    } catch (e: ApiException) {
      if (e.status == 403) State.NeedsReconnect else cachedState(c)
    } catch (e: Exception) {
      cachedState(c)
    }
  }

  // Shows the tap at once; the answer from the server replaces it, or the old
  // answer is put back if the save failed.
  fun applyOptimistic(c: Context, eventId: String, response: String) {
    val json = cachedJson(c) ?: return
    try {
      val o = JSONObject(json)
      val e = o.optJSONObject("event") ?: return
      if (e.optString("eventId") != eventId) return
      e.put("response", response)
      e.put("autoIn", false)
      saveCache(c, o.toString())
    } catch (e: Exception) {
      // Leave the cache as it was.
    }
  }

  fun respond(c: Context, eventId: String, response: String, previousJson: String?): State {
    val cfg = config(c) ?: return State.NeedsSetup
    return try {
      val json = call(cfg, "respond", eventId, response)
      saveCache(c, json)
      prefs(c).edit().remove(FAILED_AT).apply()
      State.Ready(parse(json), stale = false)
    } catch (e: Exception) {
      if (previousJson != null) saveCache(c, previousJson)
      prefs(c).edit().putLong(FAILED_AT, System.currentTimeMillis()).apply()
      if (e is ApiException && e.status == 403) State.NeedsReconnect else cachedState(c)
    }
  }

  fun snapshotCache(c: Context): String? = cachedJson(c)
}
