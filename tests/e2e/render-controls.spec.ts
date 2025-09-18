import { test, expect } from '@playwright/test'

test.describe('Render controls', () => {
  test('toggles AA and bloom without runtime errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(`pageerror: ${error.message}`)
    })
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(`console: ${message.text()}`)
      }
    })

    await page.goto('/')
    await page.waitForSelector('#sidebar')

    await page.evaluate(() => {
      const dbg = (window as any).__swordDebug
      if (!dbg || !dbg.renderHooks) throw new Error('Render hooks unavailable for tests')
      const calls: Array<{ name: string; args: unknown[] }> = []
      const wrap = (name: 'setAAMode' | 'setBloom' | 'setPostFXEnabled') => {
        const original = dbg.renderHooks[name]
        if (typeof original !== 'function') return
        dbg.renderHooks[name] = ((...args: unknown[]) => {
          calls.push({ name, args })
          return original.apply(dbg.renderHooks, args)
        })
      }
      wrap('setAAMode')
      wrap('setBloom')
      wrap('setPostFXEnabled')
      ;(window as any).__renderHookCalls = calls
    })

    await page.locator('button.tab-btn:has-text("Render")').click()

    const postFxCheckbox = page.locator('[data-field="render-quality-exposure.post-fx-pipeline"] input[type="checkbox"]')
    await postFxCheckbox.scrollIntoViewIfNeeded()
    await postFxCheckbox.uncheck()
    await expect(postFxCheckbox).not.toBeChecked()
    await postFxCheckbox.check()
    await expect(postFxCheckbox).toBeChecked()

    const aaSelect = page.locator('[data-field="render-quality-exposure.aa-mode"] select')
    await aaSelect.scrollIntoViewIfNeeded()
    await aaSelect.selectOption('none')
    await expect(aaSelect).toHaveValue('none')
    await aaSelect.selectOption('smaa')
    await expect(aaSelect).toHaveValue('smaa')

    const bloomCheckbox = page.locator('[data-field="render-post.bloom-enabled"] input[type="checkbox"]')
    await bloomCheckbox.scrollIntoViewIfNeeded()
    await bloomCheckbox.check()
    await expect(bloomCheckbox).toBeChecked()
    await bloomCheckbox.uncheck()
    await expect(bloomCheckbox).not.toBeChecked()

    const calls = await page.evaluate(() => (window as any).__renderHookCalls as Array<{ name: string; args: unknown[] }>)
    const aaCalls = calls.filter((c) => c.name === 'setAAMode')
    expect(aaCalls.length).toBeGreaterThanOrEqual(1)
    const bloomOn = calls.find((c) => c.name === 'setBloom' && Array.isArray(c.args) && c.args[0] === true)
    expect(bloomOn).toBeTruthy()
    const postFxCalls = calls.filter((c) => c.name === 'setPostFXEnabled')
    expect(postFxCalls.length).toBeGreaterThanOrEqual(1)

    expect(errors, errors.join('\n')).toEqual([])
  })
})
