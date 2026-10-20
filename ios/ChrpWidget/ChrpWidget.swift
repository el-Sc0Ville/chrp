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
    let event = WidgetEvent(
      teamId: "sample",
      eventId: "sample",
      type: "game",
      title: "Next game",
      venue: "Your rink",
      startsAt: inTwoDays,
      response: "in",
      autoIn: true
    )
    return ChrpEntry(
      date: Date(),
      state: .ready(
        WidgetPayload(
          teamName: "Your team",
          teamColor: "#2540D6",
          event: event,
          teams: [WidgetTeam(teamId: "sample", teamName: "Your team", teamColor: "#2540D6")],
          events: [event]
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

  // Hourly, and right after the soonest game starts so it rolls over to the
  // next one. Sooner after a failed save, so the error does not linger. The app
  // and the notification extension reload the widget the moment an answer
  // changes; this schedule only catches new or edited games.
  static func nextRefresh(after entry: ChrpEntry) -> Date {
    var next = entry.date.addingTimeInterval(60 * 60)
    if case .ready(let payload, _) = entry.state,
       let start = payload.allEvents.first?.startDate,
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
      let selection = ChrpStore.selection(for: payload)
      VStack(alignment: .leading, spacing: 0) {
        HeaderRow(selection: selection, compact: family == .systemSmall)
        if let event = selection.event {
          EventView(
            selection: selection,
            event: event,
            stale: stale,
            saveFailed: entry.saveFailed,
            compact: family == .systemSmall
          )
        } else {
          Text(selection.canCycleTeams && selection.filterLabel != "All teams"
               ? "No upcoming games for this team."
               : "No upcoming games scheduled.")
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(Color.white)
            .lineLimit(3)
            .padding(.top, 6)
          Spacer(minLength: 0)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
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

// Team switch on the left (tap to cycle when on several teams), ‹ 2/5 › on the right.
struct HeaderRow: View {
  let selection: WidgetSelection
  let compact: Bool

  var body: some View {
    HStack(spacing: 4) {
      if selection.canCycleTeams {
        Button(intent: CycleTeamIntent()) { teamLabel(showSwitch: true) }
          .buttonStyle(.plain)
          .accessibilityLabel(Text("\(selection.filterLabel). Tap to switch team"))
      } else {
        teamLabel(showSwitch: false)
      }
      Spacer(minLength: 2)
      if selection.count > 1 {
        Button(intent: PageEventsIntent(step: -1)) { arrow("‹", enabled: selection.index > 0) }
          .buttonStyle(.plain)
          .disabled(selection.index == 0)
          .accessibilityLabel(Text("Previous game"))
        Text("\(selection.index + 1)/\(selection.count)")
          .font(.system(size: 10, weight: .semibold).monospacedDigit())
          .foregroundStyle(Color.white.opacity(0.7))
        Button(intent: PageEventsIntent(step: 1)) { arrow("›", enabled: selection.index < selection.count - 1) }
          .buttonStyle(.plain)
          .disabled(selection.index >= selection.count - 1)
          .accessibilityLabel(Text("Next game"))
      }
    }
  }

  private func teamLabel(showSwitch: Bool) -> some View {
    HStack(spacing: 4) {
      Circle()
        .fill(Color(hex: selection.filterColor))
        .frame(width: 6, height: 6)
      Text(selection.filterLabel.uppercased())
        .font(.system(size: 10, weight: .semibold))
        .foregroundStyle(Color.white.opacity(0.7))
        .lineLimit(1)
      if showSwitch {
        Text("⇄")
          .font(.system(size: 10, weight: .bold))
          .foregroundStyle(Color.white.opacity(0.7))
      }
    }
    .padding(.vertical, 3)
    .padding(.horizontal, showSwitch ? 6 : 0)
    .background(
      Capsule().fill(showSwitch ? Color.white.opacity(0.10) : Color.clear)
    )
  }

  private func arrow(_ symbol: String, enabled: Bool) -> some View {
    Text(symbol)
      .font(.system(size: 16, weight: .bold))
      .foregroundStyle(Color.white.opacity(enabled ? 0.9 : 0.25))
      .frame(width: compact ? 18 : 24, height: 20)
      .contentShape(Rectangle())
  }
}

struct EventView: View {
  let selection: WidgetSelection
  let event: WidgetEvent
  let stale: Bool
  let saveFailed: Bool
  let compact: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: compact ? 2 : 4) {
      if selection.showTeamOnEvent, let team = selection.eventTeam {
        Text(team.teamName.uppercased())
          .font(.system(size: 9, weight: .bold))
          .foregroundStyle(Color(hex: team.teamColor).opacity(0.95))
          .lineLimit(1)
          .padding(.top, 4)
      }

      Text(event.title)
        .font(.system(size: compact ? 14 : 16, weight: .bold))
        .foregroundStyle(Color.white)
        .lineLimit(1)
        .minimumScaleFactor(0.75)
        .padding(.top, selection.showTeamOnEvent ? 0 : 4)

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
        ReplyButton(event: event, value: "in", label: "In",
                    tint: Color(hex: "#22C55E"), selected: event.response == "in")
        ReplyButton(event: event, value: "maybe", label: "Maybe",
                    tint: Color(hex: "#F59E0B"), selected: event.response == "maybe")
        ReplyButton(event: event, value: "out", label: "Out",
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
  let event: WidgetEvent
  let value: String
  let label: String
  let tint: Color
  let selected: Bool

  var body: some View {
    Button(intent: SetAvailabilityIntent(teamId: event.teamId, eventId: event.eventId, response: value)) {
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
