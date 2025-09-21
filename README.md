# Microcks Desktop

Electron wrapper that packages and runs a Microcks Spring Boot JAR locally and presents it in a native desktop window.

## Requirements
- Node.js 18+
- Java Runtime (JRE 17+) installed OR include a bundled JRE in `jre/` before packaging.
- A Microcks Spring Boot JAR.

## Setup
1. Copy your Microcks JAR into `backend/` (e.g. `backend/microcks.jar`).
2. Optionally set environment in `.env` (see `.env.example`).
3. Install dependencies and start.

## Scripts
- `npm run dev` – TypeScript watch + Electron.
- `npm run start` – Build once and start Electron.
- `npm run pack` – Prepare unpacked app.
- `npm run dist` – Build Windows installer (NSIS).

## Dev on Windows (PowerShell)
```powershell
npm install
npm run dev
```
If you don't have Java on PATH, set `JAVA_HOME` in `.env` or add a `jre/` folder.
Default Spring profile is `uber`. Set `MICROCKS_PROFILE` in `.env` to override.

## Packaging
Place `backend/*.jar` and optionally `jre/**` before running:
```powershell
npm run dist
```
Installer will include those under resources.

### Cross-platform notes
- Windows builds: NSIS installer by default.
- macOS builds: dmg and zip. Codesigning/notarization are required to distribute broadly.
- Linux builds: AppImage, deb, rpm.
- Bundled JRE: put a platform-specific JRE in `jre/` before building. The build will mark `jre/bin/java` executable on macOS/Linux automatically.

## Troubleshooting
- Backend fails to start: check logs under `%AppData%/Microcks Desktop/logs`.
- Port already in use (8080): set `PORT` in `.env`.
- Health endpoint defaults to `/api/health`. Override with `HEALTH_PATH` in `.env`.

## License
Apache-2.0