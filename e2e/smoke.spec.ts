import { expect, test, type Page } from '@playwright/test';

/** Runs against the production build with no Supabase env → labeled practice mode. */

async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

async function answerFirstOption(page: Page) {
  const option = page.getByRole('button', { name: /^Option A/ });
  await expect(option).toBeEnabled();
  const box = await option.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await option.click();
}

test('onboarding reaches a mode in two taps and completes a tie-break match', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expectNoHorizontalScroll(page);
  await page.getByRole('link', { name: /Start Playing/ }).or(page.getByRole('button', { name: /Start Playing/ })).click(); // tap 1
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText(/practice/i).first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole('link', { name: /Tie-Break Battle/ }).click(); // tap 2
  await expect(page).toHaveURL(/\/battle$/);
  await expect(page.getByText(/not a simulation of real tennis ability/)).toBeVisible();

  const result = page.getByRole('heading', { name: /Game, Set, Match!|Match over/ });
  for (let i = 0; i < 80 && !(await result.isVisible()); i++) {
    await answerFirstOption(page);
    await page.getByRole('button', { name: /^(Next point|See match result)$/ }).click();
  }
  await expect(result).toBeVisible();
  const score = await page.getByLabel(/^Final score:/).getAttribute('aria-label');
  const [, you, opp] = /You (\d+), Opponent (\d+)/.exec(score ?? '') ?? [];
  const a = Number(you);
  const b = Number(opp);
  expect(Math.max(a, b)).toBeGreaterThanOrEqual(7);
  expect(Math.abs(a - b)).toBeGreaterThanOrEqual(2);
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test('academy session shows 5 distinct questions and a recap', async ({ page }) => {
  await page.goto('/academy');
  await page.getByRole('link', { name: /Rookie/ }).click();
  const prompts = new Set<string>();
  for (let i = 0; i < 5; i++) {
    // QuestionCard renders the prompt with id="prompt-<challengeId>".
    const id = await page.locator('[id^="prompt-"]').first().getAttribute('id');
    expect(id).toMatch(/^prompt-rookie-\d{2}$/);
    prompts.add(id!);
    await answerFirstOption(page);
    await expect(page.getByText(/Correct!|Not quite/).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: /^(Next question|See recap)$/ }).click();
  }
  expect(prompts.size).toBe(5);
  await expect(page.getByRole('heading', { name: /Session complete/ })).toBeVisible();
  await expect(page.getByText(/^[0-5]\/5$/)).toBeVisible();
  await expect(page.getByText('Unranked practice').first()).toBeVisible();
});

test('daily puzzle records once per UTC day; retry is practice', async ({ page }) => {
  await page.goto('/daily');
  await expect(page.getByText(/\(UTC\)/).first()).toBeVisible();
  const firstId = await page.locator('[id^="prompt-"]').first().getAttribute('id');
  await answerFirstOption(page);
  await expect(page.getByText('✓ Daily reward recorded')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.reload();
  // Same challenge after reload on the same UTC date.
  expect(await page.locator('[id^="prompt-"]').first().getAttribute('id')).toBe(firstId);
  await answerFirstOption(page);
  await expect(page.getByText(/Already completed today/).first()).toBeVisible();
});

test('progress page renders three skill breakdowns', async ({ page }) => {
  await page.goto('/progress');
  for (const t of ['Rookie', 'Challenger', 'Strategist']) {
    await expect(page.getByText(t, { exact: false }).first()).toBeVisible();
  }
  await expectNoHorizontalScroll(page);
});
