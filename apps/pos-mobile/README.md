# POS Mobile

Expo React Native offline-first POS — bare/dev-client workflow (ADR 0001),
not managed Expo Go. Most real POS peripherals (thermal printers,
barcode/QR scanners, card readers, NFC badge readers) need native modules
Expo Go can't load.

The `android/` and `ios/` native projects are committed, not regenerated per
machine — run `pnpm prebuild` only after changing `app.json`'s native config
(package/bundle id, plugins, permissions), not as a normal dev step. Run the
app with `pnpm start` (starts the dev-client Metro server) plus
`pnpm android` / `pnpm ios` to build and launch on a device or emulator —
Expo Go will not open this app.

First target:

- Android tablets
- Android phones
- Restaurant cashiers
- Waiters
- Managers

Core responsibilities:

- Local SQLite database
- Operation log
- Product catalog cache
- Order entry
- Table service
- Cash payments offline
- Sync queue

