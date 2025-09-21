// Ensure bundled JRE executables are marked executable on macOS/Linux
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  try {
    const platform = context.electronPlatformName; // 'darwin' | 'linux' | 'win32'
    const out = context.appOutDir;
    const candidates = [];

    if (platform === 'darwin') {
      // Find *.app bundle in out dir
      const entries = fs.readdirSync(out).filter(n => n.endsWith('.app'));
      if (entries[0]) {
        candidates.push(path.join(out, entries[0], 'Contents', 'Resources', 'jre', 'bin', 'java'));
      }
    }
    // Common resources path (linux/win unpacked dir and some mac layouts)
    candidates.push(path.join(out, 'resources', 'jre', 'bin', 'java'));

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          fs.chmodSync(p, 0o755);
          context.packager.info.logger.info(`[afterPack] chmod +x ${p}`);
        } catch (e) {
          context.packager.info.logger.warn(`[afterPack] Failed to chmod ${p}: ${e}`);
        }
      }
    }
  } catch (e) {
    // Non-fatal; just log
    try { context.packager.info.logger.warn(`[afterPack] Error: ${e}`); } catch {}
  }
};
