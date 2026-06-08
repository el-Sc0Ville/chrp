import UIKit
import UserNotifications
import UserNotificationsUI

class NotificationViewController: UIViewController, UNNotificationContentExtension {

    // MARK: - State
    private var eventId = ""
    private var teamId = ""
    private var userId = ""
    private var displayName = ""
    private var accentColor: UIColor = UIColor(red: 37/255, green: 64/255, blue: 214/255, alpha: 1)
    private var hasResponded = false

    // MARK: - UI
    private let containerStack: UIStackView = {
        let sv = UIStackView()
        sv.axis = .vertical
        sv.spacing = 6
        sv.translatesAutoresizingMaskIntoConstraints = false
        return sv
    }()

    private let teamLabel: UILabel = {
        let l = UILabel()
        l.font = .systemFont(ofSize: 11, weight: .semibold)
        l.textColor = UIColor(white: 1, alpha: 0.45)
        l.text = "CHRP"
        return l
    }()

    private let eventLabel: UILabel = {
        let l = UILabel()
        l.font = .systemFont(ofSize: 18, weight: .bold)
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

    private let buttonStack: UIStackView = {
        let sv = UIStackView()
        sv.axis = .horizontal
        sv.spacing = 8
        sv.distribution = .fillEqually
        return sv
    }()

    private let confirmLabel: UILabel = {
        let l = UILabel()
        l.font = .systemFont(ofSize: 13, weight: .medium)
        l.textColor = UIColor(white: 1, alpha: 0.55)
        l.textAlignment = .center
        l.isHidden = true
        return l
    }()

    private lazy var inButton = makeButton(title: "✓  In", tag: 0)
    private lazy var outButton = makeButton(title: "✗  Out", tag: 1)
    private lazy var maybeButton = makeButton(title: "?  Maybe", tag: 2)

    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 10/255, green: 17/255, blue: 32/255, alpha: 1)
        setupLayout()
    }

    private func setupLayout() {
        view.addSubview(containerStack)

        containerStack.addArrangedSubview(teamLabel)
        containerStack.addArrangedSubview(eventLabel)
        containerStack.setCustomSpacing(10, after: eventLabel)
        containerStack.addArrangedSubview(dateLabel)
        containerStack.addArrangedSubview(locationLabel)
        containerStack.setCustomSpacing(16, after: locationLabel)
        containerStack.addArrangedSubview(buttonStack)
        containerStack.setCustomSpacing(8, after: buttonStack)
        containerStack.addArrangedSubview(confirmLabel)

        buttonStack.addArrangedSubview(inButton)
        buttonStack.addArrangedSubview(outButton)
        buttonStack.addArrangedSubview(maybeButton)

        NSLayoutConstraint.activate([
            buttonStack.heightAnchor.constraint(equalToConstant: 44),
            containerStack.topAnchor.constraint(equalTo: view.topAnchor, constant: 16),
            containerStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            containerStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            containerStack.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor, constant: -16),
        ])
    }

    private func makeButton(title: String, tag: Int) -> UIButton {
        let b = UIButton(type: .system)
        b.setTitle(title, for: .normal)
        b.titleLabel?.font = .systemFont(ofSize: 14, weight: .semibold)
        b.setTitleColor(.white, for: .normal)
        b.backgroundColor = UIColor(white: 1, alpha: 0.10)
        b.layer.cornerRadius = 10
        b.tag = tag
        b.addTarget(self, action: #selector(handleButtonTap(_:)), for: .touchUpInside)
        return b
    }

    // MARK: - UNNotificationContentExtension
    func didReceive(_ notification: UNNotification) {
        let content = notification.request.content
        let info = content.userInfo

        eventId = info["eventId"] as? String ?? ""
        teamId = info["teamId"] as? String ?? ""
        userId = info["userId"] as? String ?? ""
        displayName = info["displayName"] as? String ?? ""

        if let teamName = info["teamName"] as? String {
            teamLabel.text = teamName.uppercased()
        }

        if let hex = info["teamColor"] as? String, let color = UIColor(hex: hex) {
            accentColor = color
            teamLabel.textColor = color
            inButton.backgroundColor = color
        }

        eventLabel.text = content.title

        if let dateStr = info["eventDate"] as? String {
            dateLabel.text = dateStr
        }

        if let location = info["location"] as? String, !location.isEmpty {
            locationLabel.text = "📍  \(location)"
            locationLabel.isHidden = false
        } else {
            locationLabel.isHidden = true
        }

        view.layoutIfNeeded()
        let targetHeight = containerStack.frame.height + 32
        preferredContentSize = CGSize(width: 0, height: max(targetHeight, 180))
    }

    // MARK: - Button Actions
    @objc private func handleButtonTap(_ sender: UIButton) {
        guard !hasResponded else { return }
        hasResponded = true

        let responses = ["in", "out", "maybe"]
        let labels = ["Marked you In ✓", "Marked you Out ✗", "Marked you Maybe ?"]
        let response = responses[sender.tag]

        [inButton, outButton, maybeButton].forEach { btn in
            UIView.animate(withDuration: 0.2) {
                btn.alpha = btn.tag == sender.tag ? 1.0 : 0.25
                if btn.tag == sender.tag {
                    btn.backgroundColor = self.accentColor
                }
            }
        }

        confirmLabel.text = labels[sender.tag]
        confirmLabel.isHidden = false

        submitResponse(response)
    }

    private func submitResponse(_ response: String) {
        guard let url = URL(string: "https://northamerica-northeast1-chrp-app.cloudfunctions.net/recordAvailability") else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10

        let body: [String: String] = [
            "eventId": eventId,
            "teamId": teamId,
            "userId": userId,
            "response": response,
            "displayName": displayName,
        ]

        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        URLSession.shared.dataTask(with: request) { _, _, _ in }.resume()
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
