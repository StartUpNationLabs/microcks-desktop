// Minimal secure preload; add APIs if needed later
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('microcks', {
  version: '0.1.0',
  splash: {
    onStatus: (cb: (msg: string) => void) => {
      const listener = (_: any, msg: string) => cb(msg);
      ipcRenderer.on('splash:status', listener);
      return () => ipcRenderer.removeListener('splash:status', listener);
    },
    onLog: (cb: (line: string) => void) => {
      const listener = (_: any, line: string) => cb(line);
      ipcRenderer.on('splash:log', listener);
      return () => ipcRenderer.removeListener('splash:log', listener);
    }
  }
});
