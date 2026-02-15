import { test, expect } from './fixtures'

test.describe('Homepage', () => {
  test('loads and displays forge list', async ({ page }) => {
    await page.goto('/forges')
    await expect(page.locator('h1:has-text("Forge")')).toBeVisible()
    await expect(page.locator('h3:has-text("Star Wars Lego")')).toBeVisible()
  })

  test('forge cards show status badges', async ({ page }) => {
    await page.goto('/forges')
    await expect(page.locator('span:has-text("complete")').first()).toBeVisible()
  })

  test('clicking "New Forge" navigates to creation page', async ({ page }) => {
    await page.goto('/forges')
    await page.click('a:has-text("New Forge")', )
    await expect(page).toHaveURL(/\/forge\/new/)
  })

  test('clicking Continue on a forge navigates to it', async ({ page }) => {
    await page.goto('/forges')
    const card = page.locator('div:has-text("Star Wars Lego")').first()
    await card.hover()
    await page.click('a:has-text("Continue")')
    await expect(page).toHaveURL(/\/forge\//)
  })
})
