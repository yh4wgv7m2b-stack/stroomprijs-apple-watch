import SwiftUI

struct ContentView: View {
    @State private var snapshot: PriceSnapshot?
    @State private var error: String?
    @State private var loading = false

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text("⚡ STROOMPRIJS").font(.headline)
                if let price = snapshot?.current {
                    Text(PriceService.euro(price.totalEurPerKwh))
                        .font(.system(size: 29, weight: .bold, design: .rounded))
                        .minimumScaleFactor(0.7)
                        .lineLimit(1)
                    Text(label(price)).font(.caption.bold()).foregroundStyle(color(price))
                    Text("Geldig tot " + price.end.formatted(date: .omitted, time: .shortened))
                        .font(.caption2).foregroundStyle(.secondary)
                    Divider()
                    if let values = snapshot?.today, !values.isEmpty {
                        let low = values.min { $0.totalEurPerKwh < $1.totalEurPerKwh }!
                        let high = values.max { $0.totalEurPerKwh < $1.totalEurPerKwh }!
                        metric("Laagste", low)
                        metric("Hoogste", high)
                        Text("Gemiddeld " + PriceService.euro(values.map(\\.totalEurPerKwh).reduce(0,+) / Double(values.count)))
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                } else if let error {
                    Text(error).font(.caption).foregroundStyle(.secondary)
                } else {
                    ProgressView("Prijzen laden")
                }
                Button { Task { await refresh() } } label: {
                    Label("Vernieuwen", systemImage: "arrow.clockwise")
                }.disabled(loading)
            }.padding(.horizontal, 5)
        }
        .task { await refresh() }
    }

    private func metric(_ title: String, _ item: QuarterPrice) -> some View {
        HStack {
            Text(title).font(.caption2).foregroundStyle(.secondary)
            Spacer()
            Text(PriceService.euro(item.totalEurPerKwh)).font(.caption.bold())
        }
    }
    private func label(_ item: QuarterPrice) -> String {
        ["GOEDKOOP", "GEMIDDELD", "DUUR"][PriceService.tier(item.totalEurPerKwh, in: snapshot?.today ?? [])]
    }
    private func color(_ item: QuarterPrice) -> Color {
        [.green, .yellow, .red][PriceService.tier(item.totalEurPerKwh, in: snapshot?.today ?? [])]
    }
    @MainActor private func refresh() async {
        loading = true
        defer { loading = false }
        do { snapshot = try await PriceService.load(); error = nil }
        catch { self.error = "Prijzen ophalen mislukt. Probeer opnieuw." }
    }
}
