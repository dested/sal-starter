// What "the page overflows" means, measured in the browser (e2e/no-overflow.flow.spec.ts uses it):
// the page scrolls sideways, or a piece of text sticks out of the box that should hold it. A box
// is the nearest ancestor that clips (overflow hidden or clip) or looks like a card (a background
// plus a border or rounded corners). Ancestors that scroll sideways (overflow auto or scroll) are
// skipped: overflowing there is what they are for. Text cut on purpose (an ellipsis, a line clamp)
// and screen-reader-only text (clipped) don't count.

import type { Page, TestInfo } from '@playwright/test'

/** A small phone up to a wide desktop, with the common tablet widths between. */
export const WIDTHS = [320, 375, 390, 430, 768, 1024, 1180, 1280, 1440, 1920] as const

export type TextOverflow = { selector: string; text: string; by: number; box: string }

/** The page's sideways scroll (px) and every text that sticks out of its box, at the current width. */
export async function measureOverflow(
  page: Page
): Promise<{ scroll: number; text: TextOverflow[] }> {
  return page.evaluate(() => {
    const TOLERANCE = 1
    const describe = (el: Element): string => {
      const parts: string[] = []
      let node: Element | null = el
      while (node && node !== document.body && parts.length < 4) {
        const id = node.id ? `#${node.id}` : ''
        const cls = [...node.classList]
          .slice(0, 3)
          .map((c) => `.${CSS.escape(c)}`)
          .join('')
        parts.unshift(`${node.tagName.toLowerCase()}${id}${cls}`)
        node = node.parentElement
      }
      return parts.join(' > ')
    }
    const scrolls = (el: Element): boolean => {
      const s = getComputedStyle(el)
      return s.overflowX === 'auto' || s.overflowX === 'scroll'
    }
    const isBox = (el: Element): boolean => {
      const s = getComputedStyle(el)
      if (s.overflowX === 'hidden' || s.overflowX === 'clip') return true
      const bg = s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent'
      const edged = parseFloat(s.borderTopLeftRadius) > 0 || parseFloat(s.borderLeftWidth) > 0
      return bg && edged
    }
    const inScroller = (el: Element): boolean => {
      for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement)
        if (scrolls(n)) return true
      return false
    }
    const cutOnPurpose = (el: Element): boolean => {
      for (let n: Element | null = el; n; n = n.parentElement) {
        const s = getComputedStyle(n)
        if (s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none') return true
        if (s.clip !== 'auto' || (s.clipPath !== 'none' && s.position === 'absolute')) return true
      }
      return false
    }

    const viewport = document.documentElement.clientWidth
    const found: TextOverflow[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const text = (t.textContent ?? '').trim()
      const el = t.parentElement
      if (text === '' || !el || el.closest('script,style,noscript,template')) continue
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
      const range = document.createRange()
      range.selectNodeContents(t)
      const r = range.getBoundingClientRect()
      if (r.width < 2 || r.height < 2 || cutOnPurpose(el)) continue

      const offPage = Math.max(-r.left, r.right - viewport)
      if (offPage > TOLERANCE && !inScroller(el)) {
        found.push({
          selector: describe(el),
          text: text.slice(0, 60),
          by: Math.round(offPage),
          box: 'the page',
        })
        continue
      }
      for (let box = el.parentElement; box && box !== document.body; box = box.parentElement) {
        if (scrolls(box)) break
        if (!isBox(box)) continue
        const b = box.getBoundingClientRect()
        const by = Math.max(b.left - r.left, r.right - b.right)
        if (by > TOLERANCE)
          found.push({
            selector: describe(el),
            text: text.slice(0, 60),
            by: Math.round(by),
            box: describe(box),
          })
        break
      }
    }
    const doc = document.documentElement
    return { scroll: doc.scrollWidth - doc.clientWidth, text: found }
  })
}

/**
 * Every width where the page now open overflows, one line each naming the path, the width, the
 * element and by how much. A full-page still of each failing width is attached to the test.
 */
export async function overflowsAt(page: Page, path: string, testInfo: TestInfo): Promise<string[]> {
  const problems: string[] = []
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 })
    // Let layout settle at the new width (two frames: resize observers, then paint).
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    )
    const { scroll, text } = await measureOverflow(page)
    const lines: string[] = []
    if (scroll > 0) lines.push(`${path} @${width}px: the page scrolls sideways by ${scroll}px`)
    for (const t of text)
      lines.push(
        `${path} @${width}px: "${t.text}" (${t.selector}) sticks out of ${t.box} by ${t.by}px`
      )
    if (lines.length > 0) {
      const name = `${path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home'}-${width}.png`
      await testInfo.attach(name, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      })
    }
    problems.push(...lines)
  }
  return problems
}
