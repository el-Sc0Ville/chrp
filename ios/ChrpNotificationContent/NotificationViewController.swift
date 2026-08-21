import UIKit
import UserNotifications
import UserNotificationsUI

/// Notification Content Extension for the AVAILABILITY_REQUEST category.
///
/// This is the ONLY place the In/Out/Maybe controls are defined. The app
/// deliberately registers the AVAILABILITY_REQUEST category with an empty
/// action array (see src/firebase/notifications.ts) — adding system action
/// buttons there would render a second, duplicate set of controls beneath
/// these ones.
///
/// Tapping a button POSTs straight to the `recordAvailability` Cloud Function,
/// so the response reaches Firestore without ever launching the app.
class NotificationViewController: UIViewController, UNNotificationContentExtension {

    // MARK: - Config

    /// Fallback endpoint. Can be overridden per-notification via the
    /// `recordUrl` key in the push payload's data object, so the endpoint can
    /// move without shipping a new binary.
    private static let defaultRecordURL =
        "https://northamerica-northeast1-chrp-app.cloudfunctions.net/recordAvailability"

    // MARK: - State
    private var eventId = ""
    private var teamId = ""
    private var userId = ""
    private var displayName = ""
    private var recordURL = NotificationViewController.defaultRecordURL
    private var accentColor = UIColor(red: 37/255, green: 64/255, blue: 214/255, alpha: 1)

    /// True only while a request is in flight. Unlike a permanent "responded"
    /// flag this still lets the user correct a mis-tap once the first write
    /// settles — the endpoint writes by userId, so re-submitting is idempotent.
    private var isSubmitting = false

    private lazy var urlSession: URLSession = {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.timeoutIntervalForRequest  = 10
        cfg.timeoutIntervalForResource = 15
        return URLSession(configuration: cfg)
    }()

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

    private let statusLabel: UILabel = {
        let l = UILabel()
        l.font = .systemFont(ofSize: 13, weight: .medium)
        l.textColor = UIColor(white: 1, alpha: 0.55)
        l.textAlignment = .center
        l.numberOfLines = 2
        l.isHidden = true
        return l
    }()

    private lazy var inButton    = makeButton(title: "✓  In",     tag: 0)
    private lazy var outButton   = makeButton(title: "✗  Out",    tag: 1)
    private lazy var maybeButton = makeButton(title: "?  Maybe",  tag: 2)
    private var allButtons: [UIButton] { [inButton, outButton, maybeButton] }

    private let responseValues = ["in", "out", "maybe"]
    private let successLabels  = ["You're In ✓", "You're Out ✗", "Marked Maybe ?"]

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
        containerStack.addArrangedSubview(statusLabel)

        allButtons.forEach { buttonStack.addArrangedSubview($0) }

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
        b.accessibilityLabel = ["In", "Out", "Maybe"][tag]
        b.addTarget(self, action: #selector(handleButtonTap(_:)), for: .touchUpInside)
        return b
    }

    /// Expo's push service delivers the `data` object nested under a top-level
    /// "body" key for REMOTE notifications, and leaves it flat for locally
    /// scheduled ones — see EXNotificationSerializer.m in expo-notifications:
    ///   `return isRemote ? request.content.userInfo[@"body"] : ...userInfo;`
    ///
    /// Reading userInfo directly therefore yielded nothing on every real push:
    /// eventId/teamId/userId all arrived empty, recordAvailability rejected the
    /// request with 400, and the old code discarded the response and reported
    /// success anyway. That is why tapping In/Out/Maybe never recorded anything.
    private static func dataPayload(from userInfo: [AnyHashable: Any]) -> [AnyHashable: Any] {
        if let nested = userInfo["body"] as? [AnyHashable: Any] {
            return nested
        }
        // Some senders stringify the payload — accept that too rather than
        // silently falling back to an empty read.
        if let raw = userInfo["body"] as? String,
           let data = raw.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [AnyHashable: Any] {
            return parsed
        }
        return userInfo
    }

    // MARK: - UNNotificationContentExtension
    func didReceive(_ notification: UNNotification) {
        let content = notification.request.content
        let info    = Self.dataPayload(from: content.userInfo)

        eventId     = info["eventId"]     as? String ?? ""
        teamId      = info["teamId"]      as? String ?? ""
        userId      = info["userId"]      as? String ?? ""
        displayName = info["displayName"] as? String ?? ""

        if let override = info["recordUrl"] as? String,
           !override.isEmpty,
           override.hasPrefix("https://") {
            recordURL = override
        }

        if let teamName = info["teamName"] as? String, !teamName.isEmpty {
            teamLabel.text = teamName.uppercased()
        }

        if let hex = info["teamColor"] as? String, let color = UIColor(hex: hex) {
            accentColor = color
            teamLabel.textColor = color
        }

        eventLabel.text = content.title

        if let dateStr = info["eventDate"] as? String, !dateStr.isEmpty {
            dateLabel.text = dateStr
            dateLabel.isHidden = false
        } else {
            dateLabel.isHidden = true
        }

        if let location = info["location"] as? String, !location.isEmpty {
            locationLabel.text = "📍  \(location)"
            locationLabel.isHidden = false
        } else {
            locationLabel.isHidden = true
        }

        // Without these three IDs the endpoint would reject the write. Fail
        // visibly rather than showing buttons that silently do nothing.
        if eventId.isEmpty || teamId.isEmpty || userId.isEmpty {
            buttonStack.isHidden = true
            showStatus("Open Chrp to set your availability", isError: true)
        }

        updatePreferredContentSize()
    }

    // MARK: - Button Actions
    @objc private func handleButtonTap(_ sender: UIButton) {
        guard !isSubmitting else { return }
        isSubmitting = true

        let tag = sender.tag
        guard responseValues.indices.contains(tag) else { return }

        highlight(selectedTag: tag)
        setButtonsEnabled(false)
        showStatus("Saving…", isError: false)

        submitResponse(responseValues[tag]) { [weak self] ok in
            guard let self else { return }
            self.isSubmitting = false
            self.setButtonsEnabled(true)
            if ok {
                self.showStatus(self.successLabels[tag], isError: false)
            } else {
                // Be honest: the write did not land. Undo the optimistic
                // highlight so the user can retry rather than walking away
                // believing they replied.
                self.resetHighlight()
                self.showStatus("Couldn't save — tap to retry", isError: true)
            }
        }
    }

    private func highlight(selectedTag: Int) {
        UIView.animate(withDuration: 0.2) {
            for btn in self.allButtons {
                let active = btn.tag == selectedTag
                btn.alpha = active ? 1.0 : 0.25
                btn.backgroundColor = active ? self.accentColor : UIColor(white: 1, alpha: 0.10)
            }
        }
    }

    private func resetHighlight() {
        UIView.animate(withDuration: 0.2) {
            for btn in self.allButtons {
                btn.alpha = 1.0
                btn.backgroundColor = UIColor(white: 1, alpha: 0.10)
            }
        }
    }

    private func setButtonsEnabled(_ enabled: Bool) {
        allButtons.forEach { $0.isEnabled = enabled }
    }

    private func showStatus(_ text: String, isError: Bool) {
        statusLabel.text = text
        statusLabel.textColor = isError
            ? UIColor(red: 1, green: 0.42, blue: 0.42, alpha: 1)
            : UIColor(white: 1, alpha: 0.55)
        statusLabel.isHidden = false
        updatePreferredContentSize()
    }

    private func updatePreferredContentSize() {
        view.layoutIfNeeded()
        let target = containerStack.frame.height + 32
        preferredContentSize = CGSize(width: 0, height: max(target, 180))
    }

    // MARK: - Networking
    private func submitResponse(_ response: String, completion: @escaping (Bool) -> Void) {
        guard let url = URL(string: recordURL) else {
            DispatchQueue.main.async { completion(false) }
            return
        }

        let body: [String: String] = [
            "eventId":     eventId,
            "teamId":      teamId,
            "userId":      userId,
            "response":    response,
            "displayName": displayName,
        ]

        guard let payload = try? JSONSerialization.data(withJSONObject: body) else {
            DispatchQueue.main.async { completion(false) }
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = payload

        urlSession.dataTask(with: request) { _, urlResponse, error in
            let code = (urlResponse as? HTTPURLResponse)?.statusCode ?? 0
            let ok   = error == nil && (200..<300).contains(code)
            DispatchQueue.main.async { completion(ok) }
        }.resume()
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
            blue:  CGFloat( value & 0x0000FF)        / 255,
            alpha: 1
        )
    }
}
