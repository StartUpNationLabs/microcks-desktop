import { app, BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import os from 'node:os';
import treeKill from 'tree-kill';
import dotenv from 'dotenv';
import { waitForHttp } from '../../shared/waitForHttp';

dotenv.config();

const isDev = process.env.NODE_ENV === 'development';
// In CJS, __dirname is available

type Child = ReturnType<typeof spawn> | null;
let mainWindow: BrowserWindow | null = null;
let backendProc: Child = null;
let quitting = false;
let isOnSplash = false;

const CONFIG = {
  PORT: Number(process.env.PORT || 8080),
  HEALTH_PATH: process.env.HEALTH_PATH || '/api/health',
  JAR: process.env.MICROCKS_JAR || '',
  JAVA_HOME: process.env.JAVA_HOME || '',
  PROFILE: process.env.MICROCKS_PROFILE || 'uber'
};

function getUserDataPath(...p: string[]) {
  return path.join(app.getPath('userData'), ...p);
}

function ensureLogDir(): string {
  const dir = getUserDataPath('logs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function findJar(): string | null {
  // Priority: env MICROCKS_JAR -> packaged resource backend/*.jar -> workspace backend/*.jar
  if (CONFIG.JAR && fs.existsSync(CONFIG.JAR)) return CONFIG.JAR;
  const candidates: string[] = [];
  const appPath = app.getAppPath();
  const resourcesJar = path.join(process.resourcesPath || '', 'backend');
  const workspaceJar = path.join(appPath, 'backend');
  ;[resourcesJar, workspaceJar].forEach((dir: string) => {
    try {
      const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.jar'));
      files.forEach((f: string) => candidates.push(path.join(dir, f)));
    } catch { /* ignore */ }
  });
  return candidates[0] || null;
}

function findJavaExecutable(): string {
  // If packaged jre exists use it, else JAVA_HOME/bin/java[.exe], else 'java'
  const packagedJre = path.join(process.resourcesPath || '', 'jre');
  const javaBin = os.platform() === 'win32' ? 'java.exe' : 'java';
  const packagedJava = path.join(packagedJre, 'bin', javaBin);
  if (fs.existsSync(packagedJava)) return packagedJava;
  if (CONFIG.JAVA_HOME) {
    const javaFromHome = path.join(CONFIG.JAVA_HOME, 'bin', javaBin);
    if (fs.existsSync(javaFromHome)) return javaFromHome;
  }
  return 'java';
}

// waitForHttp moved to shared module

async function startBackend(): Promise<void> {
  sendSplash('Checking Microcks status...');
  const jar = findJar();
  // If service already up, skip spawning
  try {
    await waitForHttp(`http://localhost:${CONFIG.PORT}${CONFIG.HEALTH_PATH}`, 2000, 200);
  if (isOnSplash) mainWindow?.webContents.send('splash:log', `Detected Microcks on port ${CONFIG.PORT}`);
    return; // already running
  } catch { /* not up; continue */ }

  sendSplash('Locating Microcks JAR...');
  if (!jar) throw new Error('Microcks JAR not found. Place it under backend/ or set MICROCKS_JAR');

  sendSplash('Finding Java runtime...');
  const javaExec = findJavaExecutable();
  const logDir = ensureLogDir();
  const out = fs.createWriteStream(path.join(logDir, 'backend.out.log'), { flags: 'a' });
  const err = fs.createWriteStream(path.join(logDir, 'backend.err.log'), { flags: 'a' });

  sendSplash(`Starting Microcks backend (profile: ${CONFIG.PROFILE})...`);
  const args = ['-jar', jar, `--server.port=${CONFIG.PORT}`, `--spring.profiles.active=${CONFIG.PROFILE}`];
  if (isOnSplash) mainWindow?.webContents.send('splash:log', `Running: ${findJavaExecutable()} ${args.join(' ')}`);
  backendProc = spawn(javaExec, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  backendProc.on('error', (err) => {
    dialog.showErrorBox('Failed to start Java process', String(err));
  });
  backendProc.stdout?.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    out.write(text);
    text.split(/\r?\n/).forEach(line => line && mainWindow?.webContents.send('splash:log', line));
  });
  backendProc.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    err.write(text);
    text.split(/\r?\n/).forEach(line => line && mainWindow?.webContents.send('splash:log', line));
  });

  backendProc.on('exit', (code: number | null) => {
    if (!mainWindow) return;
    if (code !== 0) {
      dialog.showErrorBox('Microcks backend exited', `Process exited with code ${code}`);
    }
  });

  const healthUrl = `http://localhost:${CONFIG.PORT}${CONFIG.HEALTH_PATH}`;
  sendSplash('Waiting for service to become ready...');
  await waitForHttp(healthUrl).catch((e) => {
    throw e;
  });
  sendSplash('Service is ready. Loading UI...');
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, '../preload/index.js')
    }
  });

  const target = `http://localhost:${CONFIG.PORT}`;
  const appPath = app.getAppPath();
  await mainWindow.loadFile(path.join(appPath, 'renderer', 'splash.html'));
  // Show the splash immediately so app window is visible during backend startup
  if (!mainWindow.isVisible()) mainWindow.show();
  isOnSplash = true;
  // Emit an initial status/log to verify the splash channel is working
  try {
    mainWindow.webContents.send('splash:status', 'Initializing Microcks Desktop...');
    mainWindow.webContents.send('splash:log', 'Splash loaded, starting backend sequence...');
  } catch { /* ignore */ }

  try {
    await startBackend();
    await mainWindow.loadURL(target);
    isOnSplash = false;
  } catch (e: any) {
  await mainWindow.loadFile(path.join(appPath, 'renderer', 'error.html'));
    isOnSplash = false;
    dialog.showErrorBox('Microcks Desktop', e?.message || String(e));
  }

  // Window is already visible; still keep a safety in case
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

function killBackend(): Promise<void> {
  return new Promise((resolve) => {
    if (!backendProc || backendProc.killed) return resolve();
    const pid = backendProc.pid;
    if (!pid) return resolve();
    try {
      treeKill(pid, 'SIGTERM', () => resolve());
    } catch {
      resolve();
    }
  });
}

app.on('ready', async () => {
  await createWindow();
});

app.on('before-quit', async (e: any) => {
  if (quitting) return; // already quitting
  e.preventDefault();
  quitting = true;
  await killBackend();
  app.exit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Export for tests
export { waitForHttp };

function sendSplash(message: string) {
  if (!mainWindow || !isOnSplash) return;
  try {
    mainWindow.webContents.send('splash:status', message);
  } catch { /* ignore */ }
}
