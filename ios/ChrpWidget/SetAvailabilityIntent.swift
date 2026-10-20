import Foundation
import AppIntents

// Runs inside the widget when a player taps In / Maybe / Out. WidgetKit
// reloads the timeline as soon as perform() returns.
struct SetAvailabilityIntent: AppIntent {
  static let title: LocalizedStringResource = "Set availability"
  static let isDiscoverable: Bool = false

  // The team the game belongs to. Empty means the app's active team (widgets
  // added before multi-team support).
  @Parameter(title: "Team ID")
  var teamId: String

  @Parameter(title: "Event ID")
  var eventId: String

  @Parameter(title: "Response")
  var response: String

  init() {}

  init(teamId: String?, eventId: String, response: String) {
    self.teamId = teamId ?? ""
    self.eventId = eventId
    self.response = response
  }

  func perform() async throws -> some IntentResult {
    await ChrpStore.respond(teamId: teamId.isEmpty ? nil : teamId, eventId: eventId, response: response)
    return .result()
  }
}

// ‹ and › : step through upcoming games. Widgets cannot be swiped, so these
// are buttons. Uses the cached games, so it is instant and works offline.
struct PageEventsIntent: AppIntent {
  static let title: LocalizedStringResource = "Show another game"
  static let isDiscoverable: Bool = false

  @Parameter(title: "Step")
  var step: Int

  init() {}

  init(step: Int) {
    self.step = step
  }

  func perform() async throws -> some IntentResult {
    ChrpStore.page(by: step)
    return .result()
  }
}

// Tapping the team name cycles All teams → each team → All teams.
struct CycleTeamIntent: AppIntent {
  static let title: LocalizedStringResource = "Switch team"
  static let isDiscoverable: Bool = false

  init() {}

  func perform() async throws -> some IntentResult {
    ChrpStore.cycleTeam()
    return .result()
  }
}
