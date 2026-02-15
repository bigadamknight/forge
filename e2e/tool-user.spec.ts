import { test, expect, COMPLETE_FORGE_ID as FORGE_ID } from './fixtures'

test.describe('Tool User (Public Share)', () => {
  test('public tool page loads without auth', async ({ page }) => {
    await page.goto(`/tool/${FORGE_ID}`)
    await expect(page.locator('text=Star Wars Lego').first()).toBeVisible()
  })

  test('shows sidebar with components', async ({ page }) => {
    await page.goto(`/tool/${FORGE_ID}`)
    await expect(page.locator('text=Overview').first()).toBeVisible()
    await expect(page.locator('text=Find Your Perfect').first()).toBeVisible()
  })

  test('can switch between components via sidebar', async ({ page }) => {
    await page.goto(`/tool/${FORGE_ID}`)
    await expect(page.locator('text=Overview').first()).toBeVisible()
    await page.locator('text=Complete Workspace').first().click()
    await page.waitForTimeout(500)
    await page.locator('text=Key Lessons').first().click()
    await page.waitForTimeout(500)
  })

  test('does not show creator-only features', async ({ page }) => {
    await page.goto(`/tool/${FORGE_ID}`)
    await expect(page.locator('text=Overview').first()).toBeVisible()
    await expect(page.locator('button:has-text("Share")')).not.toBeVisible()
    await expect(page.locator('button:has-text("Edit")')).not.toBeVisible()
    await expect(page.locator('text=Extractions')).not.toBeVisible()
  })

  test('invalid forge ID shows error state', async ({ page }) => {
    await page.goto('/tool/00000000-0000-0000-0000-000000000000')
    await expect(page.locator('text=Tool Not Available')).toBeVisible()
  })
})
