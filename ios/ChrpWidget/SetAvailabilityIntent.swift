import Foundation
import AppIntents

// Runs inside the widget when a player taps In / Maybe / Out. WidgetKit
// reloads the timeline as soon as perform() returns.
struct SetAvailabilityIntent: AppIntent {
  static let title: LocalizedStringResource = "Set availability"
  static let isDiscoverable: Bool = false

  @Parameter(title: "Event ID")
  var eventId: String

  @Parameter(title: "Response")
  var response: String

  init() {}

  init(eventId: String, response: String) {
    self.eventId = eventId
    self.response = response
  }

  func perform() async throws -> some IntentResult {
    await ChrpStore.respond(eventId: eventId, response: response)
    return .result()
  }
}
