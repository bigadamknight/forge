import { test as base, type Page } from '@playwright/test'

// Override page.goto to use 'commit' wait strategy
// Vite dev server's HMR and module loading can delay both 'load' and 'domcontentloaded'
export const test = base.extend({
  page: async ({ page }, use) => {
    const origGoto = page.goto.bind(page)
    ;(page as any).goto = (url: string, opts?: Parameters<Page['goto']>[1]) =>
      origGoto(url, { waitUntil: 'commit', ...opts })
    await use(page)
  },
})

export { expect } from '@playwright/test'

export const COMPLETE_FORGE_ID = '0dbe839d-e638-481f-a724-ca7d46a1df36'
export const API_BASE = 'http://localhost:3071/api'
