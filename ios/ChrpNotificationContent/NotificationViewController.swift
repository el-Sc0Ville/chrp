import UIKit
import UserNotifications
import UserNotificationsUI

class NotificationViewController: UIViewController, UNNotificationContentExtension {

    // MARK: - UI
    private let stackView: UIStackView = {
        let sv = UIStackView()
        sv.axis = .vertical
        sv.spacing = 6
        sv.translatesAutoresizingMaskIntoConstraints = false
        return sv
    }()

    private let teamLabel: UILabel = {
        let l = UILabel()
        l.font = .systemFont(ofSize: 12, weight: .medium)
        l.textColor = UIColor(white: 1, alpha: 0.45)
        l.text = "CHRP"
        return l
    }()

    private let eventLabel: UILabel = {
        let l = UILabel()
        l.font = .systemFont(ofSize: 17, weight: .semibold)
        l.textColor = .white
        l.numberOfLines = 2
        return l
    }()

    private let dateLabel: UILabel = {
        let l = UILabel()
        l.font = .systemFont(ofSize: 14, weight: .regular)
        l.textColor = UIColor(white: 1, alpha: 0.65)
        return l
    }()

    private let locationLabel: UILabel = {
        let l = UILabel()
        l.font = .systemFont(ofSize: 13, weight: .regular)
        l.textColor = UIColor(white: 1, alpha: 0.45)
        return l
    }()

    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 7/255, green: 11/255, blue: 20/255, alpha: 1)
        setupLayout()
    }

    private func setupLayout() {
        view.addSubview(stackView)
        stackView.addArrangedSubview(teamLabel)
        stackView.addArrangedSubview(eventLabel)
        stackView.setCustomSpacing(10, after: eventLabel)
        stackView.addArrangedSubview(dateLabel)
        stackView.addArrangedSubview(locationLabel)

        NSLayoutConstraint.activate([
            stackView.topAnchor.constraint(equalTo: view.topAnchor, constant: 16),
            stackView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            stackView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            stackView.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor, constant: -16),
        ])
    }

    // MARK: - UNNotificationContentExtension
    func didReceive(_ notification: UNNotification) {
        let content = notification.request.content
        let info = content.userInfo

        // Team name
        if let teamName = info["teamName"] as? String {
            teamLabel.text = teamName.uppercased()
        } else if !content.subtitle.isEmpty {
            teamLabel.text = content.subtitle.uppercased()
        }

        // Team accent colour
        if let hex = info["teamColor"] as? String {
            teamLabel.textColor = UIColor(hex: hex) ?? UIColor(white: 1, alpha: 0.45)
        }

        // Event name
        eventLabel.text = content.title

        // Date/time
        if let dateStr = info["eventDate"] as? String {
            dateLabel.text = dateStr
        } else {
            dateLabel.text = content.body
        }

        // Location
        if let location = info["location"] as? String, !location.isEmpty {
            locationLabel.text = "📍  \(location)"
            locationLabel.isHidden = false
        } else {
            locationLabel.isHidden = true
        }
    }
}

// MARK: - UIColor hex helper
extension UIColor {
    convenience init?(hex: String) {
        var h = hex.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "#", with: "")
        if h.count == 3 { h = h.map { "\($0)\($0)" }.joined() }
        guard h.count == 6, let value = UInt64(h, radix: 16) else { return nil }
        self.init(
            red:   CGFloat((value & 0xFF0000) >> 16) / 255,
            green: CGFloat((value & 0x00FF00) >> 8)  / 255,
            blue:  CGFloat( value & 0x0000FF)         / 255,
            alpha: 1
        )
    }
}
