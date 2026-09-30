import Foundation

// Keys shared with the app. The app side lives in
// modules/chrp-widget/ios/ChrpWidgetModule.swift and must use the same values.
enum Shared {
  static let appGroup = "group.com.chrp.app"
  static let configKey = "chrp.widget.config"
  static let cacheKey = "chrp.widget.cache"
  static let failedAtKey = "chrp.widget.failedAt"
  static let defaultAPI = "https://northamerica-northeast1-chrp-app.cloudfunctions.net/widgetApi"

  static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }
}

// Written by the app as JSON: who to fetch for, and the per-device key the
// widgetApi function checks.
struct WidgetConfig: Codable {
  let uid: String
  let key: String
  let teamId: String
  let apiUrl: String?
}

struct WidgetEvent: Codable {
  let eventId: String
  let type: String
  let title: String
  let venue: String
  let startsAt: Double   // milliseconds since 1970
  var response: String?  // "in" | "maybe" | "out", nil when not answered
  var autoIn: Bool

  var startDate: Date { Date(timeIntervalSince1970: startsAt / 1000) }
}

struct WidgetPayload: Codable {
  let teamName: String
  let teamColor: String
  var event: WidgetEvent?
}

enum WidgetState {
  case needsSetup                      // app never opened, or signed out
  case needsReconnect                  // key or membership rejected
  case offline                         // no network and nothing usable cached
  case ready(WidgetPayload, stale: Bool)
}

enum WidgetAPIError: Error {
  case unauthorized
  case closed
  case failed
}

enum ChrpStore {
  static func loadConfig() -> WidgetConfig? {
    guard let json = Shared.defaults?.string(forKey: Shared.configKey),
          let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(WidgetConfig.self, from: data)
  }

  static func loadCache() -> WidgetPayload? {
    guard let data = Shared.defaults?.data(forKey: Shared.cacheKey) else { return nil }
    return try? JSONDecoder().decode(WidgetPayload.self, from: data)
  }

  static func saveCache(_ payload: WidgetPayload) {
    if let data = try? JSONEncoder().encode(payload) {
      Shared.defaults?.set(data, forKey: Shared.cacheKey)
    }
  }

  // True for two minutes after a reply could not be saved, so the widget can
  // say so instead of silently showing the old answer.
  static func recentlyFailed(now: Date = Date()) -> Bool {
    guard let failedAt = Shared.defaults?.object(forKey: Shared.failedAtKey) as? Double else { return false }
    return now.timeIntervalSince1970 - failedAt < 120
  }

  static func call(
    _ config: WidgetConfig,
    action: String,
    eventId: String? = nil,
    response: String? = nil
  ) async throws -> WidgetPayload {
    guard let url = URL(string: config.apiUrl ?? Shared.defaultAPI) else { throw WidgetAPIError.failed }
    var body: [String: String] = [
      "uid": config.uid,
      "key": config.key,
      "teamId": config.teamId,
      "action": action,
    ]
    if let eventId = eventId { body["eventId"] = eventId }
    if let response = response { body["response"] = response }

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.timeoutInterval = 12
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONEncoder().encode(body)

    let (data, urlResponse) = try await URLSession.shared.data(for: request)
    let status = (urlResponse as? HTTPURLResponse)?.statusCode ?? 0
    switch status {
    case 200: return try JSONDecoder().decode(WidgetPayload.self, from: data)
    case 403: throw WidgetAPIError.unauthorized
    case 409: throw WidgetAPIError.closed
    default:  throw WidgetAPIError.failed
    }
  }

  static func currentState() async -> WidgetState {
    guard let config = loadConfig() else { return .needsSetup }
    do {
      let payload = try await call(config, action: "fetch")
      saveCache(payload)
      return .ready(payload, stale: false)
    } catch WidgetAPIError.unauthorized {
      return .needsReconnect
    } catch {
      // Offline: fall back to the last answer we had, but never to a game
      // that has already started.
      if let cached = loadCache() {
        if let event = cached.event, event.startDate <= Date() { return .offline }
        return .ready(cached, stale: true)
      }
      return .offline
    }
  }

  static func respond(eventId: String, response: String) async {
    guard let config = loadConfig() else { return }
    let previous = loadCache()

    // Show the tap immediately; the timeline reload that follows confirms it.
    if var optimistic = previous, optimistic.event?.eventId == eventId {
      optimistic.event?.response = response
      optimistic.event?.autoIn = false
      saveCache(optimistic)
    }

    do {
      let payload = try await call(config, action: "respond", eventId: eventId, response: response)
      saveCache(payload)
      Shared.defaults?.removeObject(forKey: Shared.failedAtKey)
    } catch {
      // Undo the optimistic answer rather than show one that was never saved.
      if let previous = previous { saveCache(previous) }
      Shared.defaults?.set(Date().timeIntervalSince1970, forKey: Shared.failedAtKey)
    }
  }
}
