import Foundation
import AppIntents
import SwiftUI
import WidgetKit

// MARK: - Timeline

struct ChrpEntry: TimelineEntry {
  let date: Date
  let state: WidgetState
  let saveFailed: Bool

  static var sample: ChrpEntry {
    let inTwoDays = (Date().timeIntervalSince1970 + 2 * 86_400) * 1000
    return ChrpEntry(
      date: Date(),
      state: .ready(
        WidgetPayload(
          teamName: "Your team",
          teamColor: "#2540D6",
          event: WidgetEvent(
            eventId: "sample",
            type: "game",
            title: "Next game",
            venue: "Your rink",
            startsAt: inTwoDays,
            response: "in",
            autoIn: true
          )
        ),
        stale: false
      ),
      saveFailed: false
    )
  }
}

struct ChrpProvider: TimelineProvider {
  func placeholder(in context: Context) -> ChrpEntry {
    ChrpEntry.sample
  }

  func getSnapshot(in context: Context, completion: @escaping (ChrpEntry) -> Void) {
    if context.isPreview {
      completion(ChrpEntry.sample)
      return
    }
    Task {
      completion(await Self.makeEntry())
    }
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ChrpEntry>) -> Void) {
    Task {
      let entry = await Self.makeEntry()
      completion(Timeline(entries: [entry], policy: .after(Self.nextRefresh(after: entry))))
    }
  }

  static func makeEntry() async -> ChrpEntry {
    let state = await ChrpStore.currentState()
    return ChrpEntry(date: Date(), state: state, saveFailed: ChrpStore.recentlyFailed())
  }

  // Hourly, and right after the game starts so it rolls over to the next one.
  // Sooner after a failed save, so the error does not linger. Hourly is enough
  // because the app and the notification extension reload the widget the
  // moment an answer changes; this schedule only catches new or edited games.
  static func nextRefresh(after entry: ChrpEntry) -> Date {
    var next = entry.date.addingTimeInterval(60 * 60)
    if case .ready(let payload, _) = entry.state,
       let start = payload.event?.startDate,
       start > entry.date, start < next {
      next = start.addingTimeInterval(60)
    }
    if entry.saveFailed {
      next = min(next, entry.date.addingTimeInterval(125))
    }
    return next
  }
}

// MARK: - Widget

struct ChrpNextGameWidget: Widget {
  let kind = "ChrpNextGame"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: ChrpProvider()) { entry in
      ChrpWidgetView(entry: entry)
    }
    .configurationDisplayName("Next game")
    .description("See your next game and answer In, Maybe or Out without opening Chrp.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct ChrpWidgetBundle: WidgetBundle {
  var body: some Widget {
    ChrpNextGameWidget()
  }
}

// MARK: - Views

private let widgetBackground = Color(hex: "#0B1120")

struct ChrpWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: ChrpEntry

  var body: some View {
    content
      .containerBackground(for: .widget) { widgetBackground }
      .widgetURL(URL(string: "chrp://"))
  }

  @ViewBuilder
  private var content: some View {
    switch entry.state {
    case .needsSetup:
      MessageView(title: "Chrp", message: "Open Chrp once to see your next game here.")
    case .needsReconnect:
      MessageView(title: "Chrp", message: "Open Chrp to reconnect this widget.")
    case .offline:
      MessageView(title: "Chrp", message: "Can't reach Chrp right now. We'll try again soon.")
    case .ready(let payload, let stale):
      if let event = payload.event {
        EventView(
          payload: payload,
          event: event,
          stale: stale,
          saveFailed: entry.saveFailed,
          compact: family == .systemSmall
        )
      } else {
        MessageView(title: payload.teamName, message: "No upcoming games scheduled.")
      }
    }
  }
}

struct MessageView: View {
  let title: String
  let message: String

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(title.uppercased())
        .font(.system(size: 10, weight: .semibold))
        .foregroundStyle(Color.white.opacity(0.55))
        .lineLimit(1)
      Text(message)
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(Color.white)
        .lineLimit(4)
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

struct EventView: View {
  let payload: WidgetPayload
  let event: WidgetEvent
  let stale: Bool
  let saveFailed: Bool
  let compact: Bool

  private var accent: Color { Color(hex: payload.teamColor) }

  var body: some View {
    VStack(alignment: .leading, spacing: compact ? 3 : 5) {
      HStack(spacing: 5) {
        Circle()
          .fill(accent)
          .frame(width: 6, height: 6)
        Text(payload.teamName.uppercased())
          .font(.system(size: 10, weight: .semibold))
          .foregroundStyle(Color.white.opacity(0.55))
          .lineLimit(1)
      }

      Text(event.title)
        .font(.system(size: compact ? 14 : 16, weight: .bold))
        .foregroundStyle(Color.white)
        .lineLimit(1)
        .minimumScaleFactor(0.75)

      Text(dateLine)
        .font(.system(size: 12, weight: .medium))
        .foregroundStyle(Color.white.opacity(0.8))
        .lineLimit(1)
        .minimumScaleFactor(0.8)

      if !compact && !event.venue.isEmpty {
        Text(event.venue)
          .font(.system(size: 11))
          .foregroundStyle(Color.white.opacity(0.55))
          .lineLimit(1)
      }

      Spacer(minLength: 0)

      Text(statusLine)
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(statusColor)
        .lineLimit(1)
        .minimumScaleFactor(0.8)

      HStack(spacing: compact ? 4 : 8) {
        ReplyButton(eventId: event.eventId, value: "in", label: "In",
                    tint: Color(hex: "#22C55E"), selected: event.response == "in")
        ReplyButton(eventId: event.eventId, value: "maybe", label: "Maybe",
                    tint: Color(hex: "#F59E0B"), selected: event.response == "maybe")
        ReplyButton(eventId: event.eventId, value: "out", label: "Out",
                    tint: Color(hex: "#EF4444"), selected: event.response == "out")
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  private var dateLine: String {
    let start = event.startDate
    let calendar = Calendar.current
    let time = start.formatted(date: .omitted, time: .shortened)
    if calendar.isDateInToday(start) { return "Today · \(time)" }
    if calendar.isDateInTomorrow(start) { return "Tomorrow · \(time)" }
    let day = start.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
    return "\(day) · \(time)"
  }

  private var statusLine: String {
    if saveFailed { return "Couldn't save. Try again." }
    let answer: String
    switch event.response {
    case "in":    answer = event.autoIn ? "You're in (auto)" : "You're in"
    case "maybe": answer = "You're a maybe"
    case "out":   answer = "You're out"
    default:      answer = "Are you in?"
    }
    return stale ? "\(answer) · offline" : answer
  }

  private var statusColor: Color {
    if saveFailed { return Color(hex: "#F87171") }
    switch event.response {
    case "in":    return Color(hex: "#4ADE80")
    case "maybe": return Color(hex: "#FBBF24")
    case "out":   return Color(hex: "#F87171")
    default:      return Color.white
    }
  }
}

struct ReplyButton: View {
  let eventId: String
  let value: String
  let label: String
  let tint: Color
  let selected: Bool

  var body: some View {
    Button(intent: SetAvailabilityIntent(eventId: eventId, response: value)) {
      Text(label)
        .font(.system(size: 12, weight: .bold))
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .foregroundStyle(selected ? Color.black : tint)
        .frame(maxWidth: .infinity, minHeight: 28)
        .background(
          RoundedRectangle(cornerRadius: 8, style: .continuous)
            .fill(selected ? tint : tint.opacity(0.16))
        )
    }
    .buttonStyle(.plain)
    .accessibilityLabel(Text(selected ? "\(label), selected" : label))
  }
}

extension Color {
  init(hex: String) {
    var digits = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if digits.hasPrefix("#") { digits.removeFirst() }
    var value: UInt64 = 0
    Scanner(string: digits).scanHexInt64(&value)
    self.init(
      red: Double((value >> 16) & 0xFF) / 255,
      green: Double((value >> 8) & 0xFF) / 255,
      blue: Double(value & 0xFF) / 255
    )
  }
}
