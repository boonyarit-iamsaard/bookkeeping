# Chromium is the only supported browser engine

The app's one user runs it in Chrome or Edge on Android and on desktop, all of
which are Chromium, so we support only the Chromium engine. The SPA browser
suite drops its iPhone WebKit project and runs on 360px Chromium and desktop
Chromium; this narrows ADR 0006's three-project suite. WebKit-only failures,
such as WebKit reporting a fetch or chunk import cancelled at unload as a page
error, are not defects to fix.

## Considered options

- Keeping `phone-webkit`: rejected because it guards an engine nobody uses,
  and it was the suite's only source of intermittent failures.

## Consequences

- Revisit if the app is used on an iPhone or iPad, where every browser and any
  Home Screen install run on WebKit, or in desktop Safari.
- iOS-specific markup already shipped, such as the safe-area insets and the
  status bar style, stays; it costs nothing on Chromium.
