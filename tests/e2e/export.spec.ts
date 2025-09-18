import { test, expect } from '@playwright/test'

const EXPORTS = [
  { buttonText: 'GLB', expectedName: 'sword.glb' },
  { buttonText: 'OBJ', expectedName: 'sword.obj' },
  { buttonText: 'SVG Blueprint', expectedName: 'blade_outline.svg' }
] as const

test.describe('Export menu', () => {
  test('downloads GLB/OBJ/SVG files without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => { errors.push(`pageerror: ${error.message}`) })
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`)
    })

    await page.goto('/')
    await page.waitForSelector('#sidebar')

    const exportButton = page.locator('button:has-text("Export ▾")')

    for (const entry of EXPORTS) {
      await exportButton.click()
      const menuItem = page.locator(`.menu button:has-text("${entry.buttonText}")`)
      await expect(menuItem).toBeVisible()
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        menuItem.click()
      ])
      const filename = await download.suggestedFilename()
      expect(filename).toBe(entry.expectedName)
      // read stream to ensure file materializes and then cleanup
      const stream = await download.createReadStream()
      if (stream) {
        stream.resume()
        await new Promise((resolve) => stream.on('end', resolve))
      }
    }

    expect(errors, errors.join('\n')).toEqual([])
  })
})
