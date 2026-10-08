// Window bounds remembered across runs in <data dir>/window.json, restored
// only while they still land on a connected display.

import { screen, type BrowserWindow, type Rectangle } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

const boundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  maximized: z.boolean().default(false),
})
export type SavedBounds = z.infer<typeof boundsSchema>

const file = () => join(__DATA_DIR__, 'window.json')

export function savedBounds(): SavedBounds | null {
  try {
    const parsed = boundsSchema.safeParse(JSON.parse(readFileSync(file(), 'utf8')))
    if (!parsed.success) return null
    const b = parsed.data
    const onScreen = screen.getAllDisplays().some(({ workArea: a }) => {
      return (
        b.x + 80 > a.x && b.y + 40 > a.y && b.x < a.x + a.width - 80 && b.y < a.y + a.height - 40
      )
    })
    return onScreen ? b : null
  } catch {
    return null
  }
}

export function rememberBounds(win: BrowserWindow): void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let normal: Rectangle = win.getNormalBounds()
  const save = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (win.isDestroyed() || win.isMinimized()) return
      if (!win.isMaximized()) normal = win.getBounds()
      const data: SavedBounds = { ...normal, maximized: win.isMaximized() }
      writeFileSync(file(), JSON.stringify(data, null, 2) + '\n')
    }, 400)
  }
  win.on('move', save)
  win.on('resize', save)
  win.on('maximize', save)
  win.on('unmaximize', save)
}
