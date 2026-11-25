import WidgetKit
import SwiftUI

struct PriceEntry: TimelineEntry {
    let date: Date
    let price: Double?
    let tier: Int
    let validUntil: Date?
}

struct PriceProvider: TimelineProvider {
    func placeholder(in context: Context) -> PriceEntry {
        PriceEntry(date: .now, price: 0.25, tier: 0, validUntil: .now.addingTimeInterval(900))
    }
    func getSnapshot(in context: Context, completion: @escaping (PriceEntry) -> Void) {
        Task { completion(await entry()) }
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<PriceEntry>) -> Void) {
        Task {
            let item = await entry()
            completion(Timeline(entries: [item], policy: .after(Date().addingTimeInterval(15 * 60))))
        }
    }
    private func entry() async -> PriceEntry {
        do {
            let data = try await PriceService.load()
            guard let current = data.current else { return PriceEntry(date: .now, price: nil, tier: 1, validUntil: nil) }
            return PriceEntry(date: .now, price: current.totalEurPerKwh, tier: PriceService.tier(current.totalEurPerKwh, in: data.today), validUntil: current.end)
        } catch {
            return PriceEntry(date: .now, price: nil, tier: 1, validUntil: nil)
        }
    }
}

struct StroomprijsWidgetView: View {
    let entry: PriceEntry
    private var tint: Color { [.green, .yellow, .red][entry.tier] }
    var body: some View {
        if let price = entry.price {
            VStack(spacing: 2) {
                Text("⚡ STROOM").font(.system(size: 9, weight: .bold))
                Text(price.formatted(.currency(code: "EUR").locale(Locale(identifier: "nl_NL"))))
                    .font(.system(size: 18, weight: .bold, design: .rounded)).minimumScaleFactor(0.6)
                Text(["GOEDKOOP", "GEMIDDELD", "DUUR"][entry.tier])
                    .font(.system(size: 9, weight: .bold)).foregroundStyle(tint)
            }.containerBackground(.background, for: .widget)
        } else {
            Text("Geen prijs").font(.caption).containerBackground(.background, for: .widget)
        }
    }
}

@main
struct StroomprijsWidget: Widget {
    let kind = "StroomprijsWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PriceProvider()) { entry in
            StroomprijsWidgetView(entry: entry)
        }
        .configurationDisplayName("Stroomprijs")
        .description("De actuele Nederlandse kwartierprijs.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}
