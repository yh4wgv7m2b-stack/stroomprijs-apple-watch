import Foundation

struct QuarterPrice: Identifiable, Decodable {
    let periodUtc: String
    let totalEurPerKwh: Double
    var id: String { periodUtc }
    var start: Date {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: periodUtc) { return date }
        let standard = ISO8601DateFormatter()
        return standard.date(from: periodUtc) ?? .distantPast
    }
    var end: Date { start.addingTimeInterval(15 * 60) }
}

struct PriceSnapshot {
    let current: QuarterPrice?
    let today: [QuarterPrice]
    let fetchedAt: Date
}

enum PriceService {
    static let base = URL(string: "https://spotwave.eu/api")!

    static func load() async throws -> PriceSnapshot {
        let now = Date()
        let today = Calendar(identifier: .gregorian).dateComponents(in: TimeZone(identifier: "Europe/Amsterdam")!, from: now)
        let start = Calendar(identifier: .gregorian).date(from: DateComponents(timeZone: TimeZone(identifier: "Europe/Amsterdam"), year: today.year, month: today.month, day: today.day))!
        let next = Calendar(identifier: .gregorian).date(byAdding: .day, value: 1, to: start)!
        let formatter = ISO8601DateFormatter()
        let from = formatter.string(from: start)
        let to = formatter.string(from: next.addingTimeInterval(-1))
        var components = URLComponents(url: base.appendingPathComponent("spotprice"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "country", value: "NL"),
            URLQueryItem(name: "from", value: from),
            URLQueryItem(name: "to", value: to)
        ]
        var request = URLRequest(url: components.url!)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        let rows = try JSONDecoder().decode([QuarterPrice].self, from: data).filter { $0.totalEurPerKwh.isFinite }.sorted { $0.start < $1.start }
        let current = rows.first { $0.start <= now && $0.end > now }
        return PriceSnapshot(current: current, today: rows, fetchedAt: now)
    }

    static func tier(_ price: Double, in prices: [QuarterPrice]) -> Int {
        let sorted = prices.map(\\.totalEurPerKwh).sorted()
        guard sorted.count >= 3 else { return 1 }
        if price <= sorted[sorted.count / 3] { return 0 }
        if price >= sorted[(sorted.count * 2) / 3] { return 2 }
        return 1
    }

    static func euro(_ value: Double) -> String {
        value.formatted(.currency(code: "EUR").locale(Locale(identifier: "nl_NL")))
    }
}
