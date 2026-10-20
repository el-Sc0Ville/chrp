import Foundation

// Keys shared with the app. The app side lives in
// modules/chrp-widget/ios/ChrpWidgetModule.swift and must use the same values.
enum Shared {
  static let appGroup = "group.com.chrp.app"
  static let configKey = "chrp.widget.config"
  static let cacheKey = "chrp.widget.cache"
  static let failedAtKey = "chrp.widget.failedAt"
  static let fetchedAtKey = "chrp.widget.fetchedAt"
  static let forceRefreshKey = "chrp.widget.forceRefresh"
  static let teamFilterKey = "chrp.widget.teamFilter"
  static let indexKey = "chrp.widget.index"
  static let defaultAPI = "https://northamerica-northeast1-chrp-app.cloudfunctions.net/widgetApi"
  static let allTeams = "all"

  static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }
}

// Written by the app as JSON: who to fetch for, and the per-device key the
// widgetApi function checks. teamId is the app's active team.
struct WidgetConfig: Codable {
  let uid: String
  let key: String
  let teamId: String
  let apiUrl: String?
}

struct WidgetTeam: Codable {
  let teamId: String
  let teamName: String
  let teamColor: String
}

struct WidgetEvent: Codable {
  let teamId: String?    // absent in caches written before multi-team support
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
  // Single-game fields, kept for older caches and older servers.
  let teamName: String
  let teamColor: String
  var event: WidgetEvent?
  // Every upcoming game across the player's teams, soonest first.
  var teams: [WidgetTeam]?
  var events: [WidgetEvent]?

  var allEvents: [WidgetEvent] {
    if let events = events { return events }
    if let event = event { return [event] }
    return []
  }

  var allTeams: [WidgetTeam] {
    if let teams = teams, !teams.isEmpty { return teams }
    return [WidgetTeam(teamId: event?.teamId ?? "", teamName: teamName, teamColor: teamColor)]
  }

  func team(for event: WidgetEvent) -> WidgetTeam? {
    allTeams.first { $0.teamId == event.teamId } ?? (allTeams.count == 1 ? allTeams[0] : nil)
  }
}

// What the widget shows right now: the chosen team filter and position.
struct WidgetSelection {
  let event: WidgetEvent?
  let eventTeam: WidgetTeam?
  let index: Int
  let count: Int
  let filterLabel: String
  let filterColor: String
  let canCycleTeams: Bool
  let showTeamOnEvent: Bool
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

  static func saveCache(_ payload: WidgetPayload, fresh: Bool) {
    if let data = try? JSONEncoder().encode(payload) {
      Shared.defaults?.set(data, forKey: Shared.cacheKey)
      if fresh { Shared.defaults?.set(Date().timeIntervalSince1970, forKey: Shared.fetchedAtKey) }
    }
  }

  // True for two minutes after a reply could not be saved, so the widget can
  // say so instead of silently showing the old answer.
  static func recentlyFailed(now: Date = Date()) -> Bool {
    guard let failedAt = Shared.defaults?.object(forKey: Shared.failedAtKey) as? Double else { return false }
    return now.timeIntervalSince1970 - failedAt < 120
  }

  // Paging and switching teams only re-read the cache, so they are instant.
  // Go to the network when the app asked for it, or the data is 15 min old.
  static func shouldFetch(now: Date = Date()) -> Bool {
    guard let defaults = Shared.defaults else { return true }
    if defaults.bool(forKey: Shared.forceRefreshKey) { return true }
    guard loadCache() != nil,
          let fetchedAt = defaults.object(forKey: Shared.fetchedAtKey) as? Double else { return true }
    return now.timeIntervalSince1970 - fetchedAt > 15 * 60
  }

  static func call(
    _ config: WidgetConfig,
    action: String,
    teamId: String? = nil,
    eventId: String? = nil,
    response: String? = nil
  ) async throws -> WidgetPayload {
    guard let url = URL(string: config.apiUrl ?? Shared.defaultAPI) else { throw WidgetAPIError.failed }
    var body: [String: String] = [
      "uid": config.uid,
      "key": config.key,
      "teamId": teamId ?? config.teamId,
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

  static func cachedState(now: Date = Date()) -> WidgetState {
    guard loadConfig() != nil else { return .needsSetup }
    guard var cached = loadCache() else { return .offline }
    // Never show a game that has already started.
    cached.events = cached.allEvents.filter { $0.startDate > now }
    if let event = cached.event, event.startDate <= now { cached.event = nil }
    return .ready(cached, stale: true)
  }

  static func currentState() async -> WidgetState {
    guard let config = loadConfig() else { return .needsSetup }
    if !shouldFetch() {
      if case .ready(let payload, _) = cachedState() { return .ready(payload, stale: false) }
    }
    do {
      let payload = try await call(config, action: "fetch")
      saveCache(payload, fresh: true)
      Shared.defaults?.set(false, forKey: Shared.forceRefreshKey)
      return .ready(payload, stale: false)
    } catch WidgetAPIError.unauthorized {
      return .needsReconnect
    } catch {
      // Offline: fall back to the last data we had.
      let state = cachedState()
      if case .ready(let payload, _) = state, payload.allEvents.isEmpty, loadCache()?.allEvents.isEmpty == false {
        return .offline
      }
      return state
    }
  }

  // ─── Filter and position ──────────────────────────────────────────────────

  static func selection(for payload: WidgetPayload) -> WidgetSelection {
    let teams = payload.allTeams
    let canCycle = teams.count > 1
    var filter = Shared.defaults?.string(forKey: Shared.teamFilterKey) ?? Shared.allTeams
    if filter != Shared.allTeams && !teams.contains(where: { $0.teamId == filter }) {
      filter = Shared.allTeams  // left that team
    }
    let events = payload.allEvents.filter { filter == Shared.allTeams || $0.teamId == filter }
    let stored = Shared.defaults?.integer(forKey: Shared.indexKey) ?? 0
    let index = events.isEmpty ? 0 : min(max(stored, 0), events.count - 1)
    let event = events.isEmpty ? nil : events[index]
    let filterTeam = teams.first { $0.teamId == filter }

    let label: String
    let color: String
    if !canCycle {
      label = teams.first?.teamName ?? payload.teamName
      color = teams.first?.teamColor ?? payload.teamColor
    } else if let filterTeam = filterTeam {
      label = filterTeam.teamName
      color = filterTeam.teamColor
    } else {
      label = "All teams"
      color = event.flatMap { payload.team(for: $0)?.teamColor } ?? payload.teamColor
    }

    return WidgetSelection(
      event: event,
      eventTeam: event.flatMap { payload.team(for: $0) },
      index: index,
      count: events.count,
      filterLabel: label,
      filterColor: color,
      canCycleTeams: canCycle,
      showTeamOnEvent: canCycle && filterTeam == nil
    )
  }

  static func page(by delta: Int) {
    guard let payload = loadCache() else { return }
    let current = selection(for: payload)
    guard current.count > 0 else { return }
    let next = min(max(current.index + delta, 0), current.count - 1)
    Shared.defaults?.set(next, forKey: Shared.indexKey)
  }

  static func cycleTeam() {
    guard let payload = loadCache() else { return }
    let order = [Shared.allTeams] + payload.allTeams.map { $0.teamId }
    let current = Shared.defaults?.string(forKey: Shared.teamFilterKey) ?? Shared.allTeams
    let position = order.firstIndex(of: current) ?? 0
    Shared.defaults?.set(order[(position + 1) % order.count], forKey: Shared.teamFilterKey)
    Shared.defaults?.set(0, forKey: Shared.indexKey)
  }

  // ─── Answering ────────────────────────────────────────────────────────────

  static func respond(teamId: String?, eventId: String, response: String) async {
    guard let config = loadConfig() else { return }
    let previous = loadCache()

    // Show the tap immediately; the timeline reload that follows confirms it.
    if var optimistic = previous {
      if var events = optimistic.events, let i = events.firstIndex(where: { $0.eventId == eventId }) {
        events[i].response = response
        events[i].autoIn = false
        optimistic.events = events
      }
      if optimistic.event?.eventId == eventId {
        optimistic.event?.response = response
        optimistic.event?.autoIn = false
      }
      saveCache(optimistic, fresh: false)
    }

    do {
      let payload = try await call(config, action: "respond", teamId: teamId, eventId: eventId, response: response)
      saveCache(payload, fresh: true)
      Shared.defaults?.removeObject(forKey: Shared.failedAtKey)
    } catch {
      // Undo the optimistic answer rather than show one that was never saved.
      if let previous = previous { saveCache(previous, fresh: false) }
      Shared.defaults?.set(Date().timeIntervalSince1970, forKey: Shared.failedAtKey)
    }
  }
}
