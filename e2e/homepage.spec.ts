import { test, expect } from './fixtures'

test.describe('Homepage', () => {
  test('loads and displays forge list', async ({ page }) => {
    await page.goto('/forges')
    await expect(page.locator('h1:has-text("Forge")')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('h3:has-text("Star Wars Lego")')).toBeVisible()
  })

  test('forge cards show status badges', async ({ page }) => {
    await page.goto('/forges')
    await expect(page.locator('span:has-text("complete")').first()).toBeVisible({ timeout: 10000 })
  })

  test('clicking "New Forge" navigates to creation page', async ({ page }) => {
    await page.goto('/forges')
    await page.click('a:has-text("New Forge")', { timeout: 10000 })
    await expect(page).toHaveURL(/\/forge\/new/)
  })

  test('clicking Continue on a forge navigates to it', async ({ page }) => {
    await page.goto('/forges')
    const card = page.locator('div:has-text("Star Wars Lego")').first()
    await card.hover({ timeout: 10000 })
    await page.click('a:has-text("Continue")')
    await expect(page).toHaveURL(/\/forge\//)
  })
})
