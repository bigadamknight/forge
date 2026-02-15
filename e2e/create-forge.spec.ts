import { test, expect } from './fixtures'

test.describe('Create Forge', () => {
  test('shows the creation form with all fields', async ({ page }) => {
    await page.goto('/forge/new')
    await expect(page.locator('text=Your Name')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Your Area of Expertise')).toBeVisible()
    await expect(page.locator('text=Interview Depth')).toBeVisible()
  })

  test('can fill in forge details', async ({ page }) => {
    await page.goto('/forge/new')
    await page.fill('input[placeholder*="Sarah"]', 'Test Expert', { timeout: 10000 })
    await page.fill('input[placeholder*="community food bank"]', 'Automated Testing')
    await page.fill('input[placeholder*="Community organisers"]', 'QA Engineers')
    await expect(page.locator('input[placeholder*="Sarah"]')).toHaveValue('Test Expert')
    await expect(page.locator('input[placeholder*="community food bank"]')).toHaveValue('Automated Testing')
  })

  test('shows interview depth presets', async ({ page }) => {
    await page.goto('/forge/new')
    await expect(page.locator('text=Quick')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Standard')).toBeVisible()
    await expect(page.locator('text=Deep')).toBeVisible()
  })
})
