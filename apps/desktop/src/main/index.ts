// Electron main process: one window, the tRPC router over IPC, and the
// lifecycle plumbing every desktop app needs:
//   - all Electron state pinned to <repo>/data/.private/electron (never %APPDATA%)
//   - single instance: a second launch forwards argv + cwd and focuses the window
//   - window bounds restored only while still on a connected display
//   - contextIsolation + sandbox, no nodeIntegration, strict CSP (index.html)
//   - external links go to the OS browser; the window never navigates away

import { createIpcHandler } from '@app/trpc-ipc/main'
import { app, BrowserWindow, ipcMain, nativeTheme, screen, shell } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { emitLaunch } from './launches'
import { appRouter } from './router'
import { rememberBounds, savedBounds } from './window-state'

// Before `ready`: Electron resolves these paths lazily but caches them early.
mkdirSync(__DATA_DIR__, { recursive: true })
app.setPath('userData', __DATA_DIR__)
app.setPath('sessionData', join(__DATA_DIR__, 'session'))
app.setPath('crashDumps', join(__DATA_DIR__, 'crashes'))
app.setPath('logs', join(__DATA_DIR__, 'logs'))

let win: BrowserWindow | null = null

function isExternalUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://') || url.startsWith('mailto:')
}

function createWindow(): BrowserWindow {
  const work = screen.getPrimaryDisplay().workArea
  const width = Math.min(1280, work.width - 80)
  const height = Math.min(840, work.height - 80)
  const saved = savedBounds()
  const bounds = saved ?? {
    x: work.x + Math.round((work.width - width) / 2),
    y: work.y + Math.round((work.height - height) / 2),
    width,
    height,
  }
  const w = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 720,
    minHeight: 480,
    show: false,
    title: app.getName(),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0a0a0a' : '#ffffff',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })
  if (saved?.maximized === true) w.maximize()
  rememberBounds(w)
  w.once('ready-to-show', () => w.show())

  w.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  w.webContents.on('will-navigate', (event, url) => {
    if (url === w.webContents.getURL()) return
    event.preventDefault()
    if (isExternalUrl(url)) void shell.openExternal(url)
  })

  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (!app.isPackaged && devUrl !== undefined) void w.loadURL(devUrl)
  else void w.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  return w
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv, cwd) => {
    if (win !== null) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
    emitLaunch({ argv, cwd, at: new Date() })
  })

  void app.whenReady().then(() => {
    createIpcHandler({ router: appRouter, ipcMain, createContext: () => ({}) })
    win = createWindow()
    win.on('closed', () => {
      win = null
    })
  })

  app.on('window-all-closed', () => app.quit())
}
