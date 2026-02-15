import { test, expect } from './fixtures'

test.describe('Landing Page', () => {
  test('shows hero with tagline', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1:has-text("Expert knowledge")')).toBeVisible()
    await expect(page.locator('text=forged into tools')).toBeVisible()
  })

  test('shows hackathon context', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Claude Code Hackathon')).toBeVisible()
  })

  test('shows Opus roles section', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Powered by Claude Opus')).toBeVisible()
    await expect(page.locator('text=Interview Planner')).toBeVisible()
    await expect(page.locator('text=Conductor').first()).toBeVisible()
  })

  test('Try It Out button navigates to forge list', async ({ page }) => {
    await page.goto('/')
    await page.locator('a:has-text("Try It Out")').click()
    await expect(page).toHaveURL(/\/forges/)
  })

  test('shows problem statement', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Break the Barriers')).toBeVisible()
  })
})
