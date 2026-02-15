import { test, expect, COMPLETE_FORGE_ID as FORGE_ID } from './fixtures'

test.describe('Tool View (Creator)', () => {
  test('loads tool with tabs for each component', async ({ page }) => {
    await page.goto(`/forge/${FORGE_ID}/tool`)
    await expect(page.locator('text=Star Wars Lego').first()).toBeVisible()
    await expect(page.locator('text=Find Your Perfect').first()).toBeVisible()
  })

  test('can switch between component tabs', async ({ page }) => {
    await page.goto(`/forge/${FORGE_ID}/tool`)
    // Click on the step_by_step tab
    await page.locator('span:has-text("Complete Workspace Setup")').first().click()
    await page.waitForTimeout(500)
    // Click on the custom tab
    await page.locator('span:has-text("Key Lessons")').first().click()
    await page.waitForTimeout(500)
  })

  test('checklist items are interactive', async ({ page }) => {
    await page.goto(`/forge/${FORGE_ID}/tool`)
    // Click the checklist tab using the tab button specifically
    await page.locator('button:has-text("Pre-Purchase Research")').first().click()
    await page.waitForTimeout(500)
    const checkbox = page.locator('input[type="checkbox"]').first()
    if (await checkbox.count() > 0) {
      const wasChecked = await checkbox.isChecked()
      await checkbox.click()
      if (wasChecked) {
        await expect(checkbox).not.toBeChecked()
      } else {
        await expect(checkbox).toBeChecked()
      }
    }
  })

  test('share button opens modal with URL', async ({ page }) => {
    await page.goto(`/forge/${FORGE_ID}/tool`)
    const shareBtn = page.locator('button:has-text("Share")')
    await expect(shareBtn).toBeVisible()
    await shareBtn.click()
    const urlInput = page.locator('input[readonly]')
    await expect(urlInput).toBeVisible()
    const url = await urlInput.inputValue()
    expect(url).toContain(`/tool/${FORGE_ID}`)
  })

  test('share modal copy button shows feedback', async ({ page }) => {
    await page.goto(`/forge/${FORGE_ID}/tool`)
    await page.click('button:has-text("Share")')
    await page.click('button:has-text("Copy")')
    await expect(page.locator('text=Copied')).toBeVisible()
  })

  test('workspace sidebar shows navigation panels', async ({ page }) => {
    await page.goto(`/forge/${FORGE_ID}/tool`)
    await expect(page.locator('text=Interview').first()).toBeVisible()
    await expect(page.locator('text=Knowledge').first()).toBeVisible()
  })
})
