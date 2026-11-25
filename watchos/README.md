# Stroomprijs voor Apple Watch

Dit is de native watchOS-app en WidgetKit-complicatie voor het bestaande Stroomprijs-project.

## Functies
- Haalt Nederlandse kwartierprijzen rechtstreeks op bij SpotWave.
- Toont actuele prijs, kleurcategorie, eindtijd van het kwartier, minimum, maximum en gemiddelde.
- WidgetKit-complicaties voor rond, rechthoekig en inline.
- Widget vraagt periodiek een nieuwe tijdlijn aan; watchOS bepaalt zelf wanneer die wordt uitgevoerd.

## Bouwen
Project is gegenereerd met XcodeGen. Open `project.yml` met XcodeGen of genereer lokaal:
```sh
brew install xcodegen
cd watchos
xcodegen generate
open StroomprijsWatch.xcodeproj
```

Kies je eigen Apple Developer Team in Signing & Capabilities en bouw voor een gekoppelde Apple Watch.

## Belangrijk
De bronprijs is indicatief en gebruikt dezelfde SpotWave API als de webapp. Er is nog geen ondertekende installatie of TestFlight-release. Daarvoor is Apple signing/provisioning nodig. Widget-verversing wordt door watchOS beheerd en is niet gegarandeerd exact iedere 15 minuten.
