import UIKit
import UserNotifications
import UserNotificationsUI

class NotificationViewController: UIViewController, UNNotificationContentExtension {

    private let titleLabel = UILabel()
    private let bodyLabel  = UILabel()
    private let buttonRow  = UIStackView()

    // #070B14 navy
    private let navyColor = UIColor(red: 7/255.0, green: 11/255.0, blue: 20/255.0, alpha: 1)
    // #2F6BFF signal blue
    private let blueColor = UIColor(red: 47/255.0, green: 107/255.0, blue: 255/255.0, alpha: 1)
    private let dimWhite  = UIColor(white: 1, alpha: 0.08)
    private let subWhite  = UIColor(white: 1, alpha: 0.65)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = navyColor
        setupUI()
    }

    // Called when notification is delivered to the extension
    func didReceive(_ notification: UNNotification) {
        titleLabel.text = notification.request.content.title
        bodyLabel.text  = notification.request.content.body
    }

    // Called when a system action button (IN / OUT / MAYBE) is tapped
    func didReceive(
        _ response: UNNotificationResponse,
        completionHandler completion: @escaping (UNNotificationContentExtensionResponseOption) -> Void
    ) {
        highlight(actionId: response.actionIdentifier)
        // Dismiss without opening the app — App.tsx background handler
        // (addNotificationResponseReceivedListener) writes to Firestore.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
            completion(.dismiss)
        }
    }

    // MARK: – Private

    private func setupUI() {
        titleLabel.font          = .systemFont(ofSize: 15, weight: .semibold)
        titleLabel.textColor     = .white
        titleLabel.numberOfLines = 1
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        bodyLabel.font          = .systemFont(ofSize: 13)
        bodyLabel.textColor     = subWhite
        bodyLabel.numberOfLines = 3
        bodyLabel.translatesAutoresizingMaskIntoConstraints = false

        buttonRow.axis         = .horizontal
        buttonRow.distribution = .fillEqually
        buttonRow.spacing      = 8
        buttonRow.translatesAutoresizingMaskIntoConstraints = false

        let actions: [(String, String)] = [
            ("IN",    "✅ In"),
            ("OUT",   "❌ Out"),
            ("MAYBE", "🟡 Maybe"),
        ]
        for (id, label) in actions {
            buttonRow.addArrangedSubview(makeButton(actionId: id, label: label))
        }

        [titleLabel, bodyLabel, buttonRow].forEach { view.addSubview($0) }

        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: view.topAnchor, constant: 14),
            titleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            titleLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),

            bodyLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 4),
            bodyLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            bodyLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),

            buttonRow.topAnchor.constraint(equalTo: bodyLabel.bottomAnchor, constant: 14),
            buttonRow.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            buttonRow.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            buttonRow.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -14),
            buttonRow.heightAnchor.constraint(equalToConstant: 44),
        ])
    }

    private func makeButton(actionId: String, label: String) -> UIButton {
        let btn = UIButton(type: .custom)
        btn.setTitle(label, for: .normal)
        btn.titleLabel?.font          = .systemFont(ofSize: 14, weight: .medium)
        btn.backgroundColor           = dimWhite
        btn.layer.cornerRadius        = 8
        btn.layer.borderWidth         = 0.5
        btn.layer.borderColor         = UIColor(white: 1, alpha: 0.15).cgColor
        btn.accessibilityIdentifier   = actionId
        btn.addTarget(self, action: #selector(buttonTapped(_:)), for: .touchUpInside)
        return btn
    }

    @objc private func buttonTapped(_ sender: UIButton) {
        guard let actionId = sender.accessibilityIdentifier else { return }
        highlight(actionId: actionId)
        // Pass the selected response back to the app via the default action.
        // App.tsx handles DEFAULT_ACTION_IDENTIFIER → navigates to EventDetail.
        extensionContext?.performNotificationDefaultAction()
    }

    private func highlight(actionId: String) {
        for case let btn as UIButton in buttonRow.arrangedSubviews {
            let active = btn.accessibilityIdentifier == actionId
            UIView.animate(withDuration: 0.15) {
                btn.backgroundColor = active ? self.blueColor : self.dimWhite
            }
        }
    }
}
