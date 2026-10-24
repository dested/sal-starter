// `bun run tokens` (root): rewrites colors.json from tokens.css + theme.css. Run
// it after every tokens.css edit; tokens.test.ts fails while colors.json is stale.
import { writeFileSync } from 'node:fs'
import { emitColors } from './css'

const colors = emitColors()
writeFileSync(new URL('./colors.json', import.meta.url), JSON.stringify(colors, null, 2) + '\n')
console.log(`colors.json: ${Object.keys(colors).length} colors from tokens.css`)
