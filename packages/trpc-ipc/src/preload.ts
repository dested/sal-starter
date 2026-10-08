// Preload side: puts `{ send, onMessage }` on `window.trpcIpc` and nothing
// else. Call `exposeTrpcIpc()` from the app's preload script.

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { CHANNEL, type IpcBridge, type IpcResponse } from './protocol'

export const BRIDGE_KEY = 'trpcIpc'

export function exposeTrpcIpc(): void {
  const bridge: IpcBridge = {
    send(message) {
      ipcRenderer.send(CHANNEL, message)
    },
    onMessage(listener) {
      // Main only ever sends IpcResponse on this channel (main.ts `respond`).
      const handler = (_event: IpcRendererEvent, message: IpcResponse) => listener(message)
      ipcRenderer.on(CHANNEL, handler)
      return () => {
        ipcRenderer.removeListener(CHANNEL, handler)
      }
    },
  }
  contextBridge.exposeInMainWorld(BRIDGE_KEY, bridge)
}
