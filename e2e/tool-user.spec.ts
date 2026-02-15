import { test, expect, COMPLETE_FORGE_ID as FORGE_ID } from './fixtures'

test.describe('Tool User (Public Share)', () => {
  test('public tool page loads without auth', async ({ page }) => {
    await page.goto(`/tool/${FORGE_ID}`)
    await expect(page.locator('text=Adam Knight').first()).toBeVisible({ timeout: 10000 })
  })

  test('shows component tabs', async ({ page }) => {
    await page.goto(`/tool/${FORGE_ID}`)
    await expect(page.locator('text=Find Your Perfect').first()).toBeVisible({ timeout: 10000 })
  })

  test('can switch between component tabs', async ({ page }) => {
    await page.goto(`/tool/${FORGE_ID}`)
    await page.locator('button:has-text("Complete Workspace")').first().click()
    await page.waitForTimeout(500)
    await page.locator('button:has-text("Key Lessons")').first().click()
    await page.waitForTimeout(500)
  })

  test('does not show creator-only features', async ({ page }) => {
    await page.goto(`/tool/${FORGE_ID}`)
    await page.waitForTimeout(1000)
    await expect(page.locator('button:has-text("Share")')).not.toBeVisible()
  })

  test('invalid forge ID shows error state', async ({ page }) => {
    await page.goto('/tool/00000000-0000-0000-0000-000000000000')
    await expect(page.locator('text=Tool Not Available')).toBeVisible({ timeout: 10000 })
  })
})
