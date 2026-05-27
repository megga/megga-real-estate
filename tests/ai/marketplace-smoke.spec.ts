// AI-driven smoke test (Stagehand + Claude Haiku 4.5).
//
// What it does: opens /louer in a real browser, asks the LLM to count the
// visible property cards, asserts the count is > 0. The point is not to
// replicate the scripted E2E suite — it's to verify Claude can navigate the
// marketplace and read its content correctly, which catches a class of
// regressions scripted selectors miss (e.g. card text changed but selector
// still matched, or page renders but is visually broken).
//
// Cost: ~1-3 cents per run (Haiku 4.5 is cheap; 1 navigate + 1 extract).
//
// Setup (one-time):
//   1. Get an Anthropic API key from https://console.anthropic.com
//   2. Add to .env.local (gitignored):     ANTHROPIC_API_KEY=sk-ant-...
//      or export in shell:                 export ANTHROPIC_API_KEY=sk-ant-...
//
// Run:
//   npm run test:e2e:ai
//
// The test is intentionally NOT in the CI workflow — it spends real money
// and depends on a third-party API. Run locally on demand.

import { test, expect } from '@playwright/test'
import { Stagehand } from '@browserbasehq/stagehand'
import { z } from 'zod'

const HAS_KEY = !!process.env.ANTHROPIC_API_KEY

test.describe('AI smoke — marketplace /louer', () => {
  test.skip(!HAS_KEY, 'ANTHROPIC_API_KEY not set — see file header for setup')

  test('Claude can count property listings on /louer', async () => {
    const stagehand = new Stagehand({
      env: 'LOCAL',
      model: {
        modelName: 'claude-haiku-4-5-20251001',
        apiKey: process.env.ANTHROPIC_API_KEY!,
        provider: 'anthropic',
      },
    })
    await stagehand.init()

    try {
      const page = stagehand.context.pages()[0]
      await page.goto('http://localhost:5173/louer')
      await page.waitForLoadState('networkidle')
      // Give the infinite-query a beat to settle the first batch
      await page.waitForTimeout(2_000)

      const result = await stagehand.extract({
        instruction:
          'Count the visible property listing cards on this rental marketplace page. Each card displays a property with a price, rooms, and surface area.',
        schema: z.object({
          listingCount: z
            .number()
            .describe('Number of property cards visible in the main grid'),
          sampleTitle: z
            .string()
            .describe('Title or address of the first visible property card'),
        }),
      })

       
      console.log('[AI smoke] extracted:', result)

      expect(
        result.listingCount,
        `AI expected ≥1 listing, got ${result.listingCount}. Sample: "${result.sampleTitle}"`
      ).toBeGreaterThan(0)
      expect(result.sampleTitle.length).toBeGreaterThan(2)
    } finally {
      await stagehand.close()
    }
  })
})
