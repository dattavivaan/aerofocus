import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const T0 = new Date('2026-11-14T18:00:00Z');

async function chooseDestination(page: Page, query: string) {
  await page.getByLabel('To', { exact: true }).fill(query);
  await page.getByRole('option').first().waitFor();
  await page.keyboard.press('Enter');
}

async function bookAndBoard(page: Page, dest: string, seat: string, meal?: string) {
  await chooseDestination(page, dest);
  if (meal) await page.getByText(meal, { exact: true }).click();
  await page.getByRole('button', { name: /Choose your seat/ }).click();
  await page.locator(`[data-seat="${seat}"]`).click();
  await page.getByRole('button', { name: `Confirm seat ${seat}` }).click();
  await expect(page.getByRole('article')).toBeVisible();
  await page.getByRole('button', { name: 'Board flight' }).first().click();
  await page.waitForURL('**/flight');
}

async function start(page: Page) {
  await page.clock.install({ time: T0 });
  await page.goto('/');
  await page.getByRole('button', { name: /Guest Pass/ }).click();
  await page.waitForURL('**/book');
}

/** Jump the clock, then let the 1-second timer run. */
async function skip(page: Page, time: string) {
  await page.clock.fastForward(time);
  await page.clock.runFor(1500);
}

const noSidewaysScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

test('books SEA → SFO in seat 14A and shows the right pass', async ({ page }) => {
  await start(page);
  await chooseDestination(page, 'san fr');
  const route = page.getByRole('region', { name: 'Route' });
  await expect(route).toContainText('SFO');
  await expect(route).toContainText('1h 50m');
  await expect(route).toContainText('679 mi');
  await noSidewaysScroll(page);
  await page.getByText('Coding', { exact: true }).click();
  await page.getByRole('button', { name: /Choose your seat/ }).click();
  await expect(page.getByRole('button', { name: 'Seat 14A, window' })).toHaveAttribute('aria-pressed', 'true');
  await noSidewaysScroll(page);
  await page.getByRole('button', { name: 'Confirm seat 14A' }).click();
  const pass = page.getByRole('article');
  for (const text of ['SEA', 'SFO', 'Guest', '14A · Window', '1h 50m', 'Snack & Beverage 15m', '679 mi', 'Coding']) {
    await expect(pass).toContainText(text);
  }
  await expect(pass).toContainText(/AX\d{3}/);
  await noSidewaysScroll(page);
  // The pass survives a reload.
  await page.reload();
  await expect(page.getByRole('article')).toContainText('14A · Window');
});

test('a 45 min flight runs start to finish with a break and survives a reload', async ({ page }) => {
  await start(page);
  await bookAndBoard(page, 'PDX', '14A', 'Beverage Service · 5 min');
  const timer = page.getByRole('timer');
  const phase = page.locator('header [role=status]');
  await page.clock.runFor(1500);
  await expect(phase).toHaveText('Taxiing');
  await skip(page, '20:30'); // break runs 20:00–25:00
  await expect(phase).toHaveText('Meal Service');
  await expect(page.getByText('Meal Service Active')).toBeVisible();
  await page.reload();
  await page.clock.runFor(1500);
  await expect(phase).toHaveText('Meal Service');
  await skip(page, '10:00'); // slept through the end of the break
  await expect(phase).toHaveText('Fasten Seatbelt');
  await expect(timer).toHaveText('00:20:00');
  await skip(page, '03:00'); // the clock is stopped while waiting
  await expect(timer).toHaveText('00:20:00');
  await page.getByRole('button', { name: 'Fasten seatbelt' }).click();
  await skip(page, '19:00');
  await expect(phase).toHaveText('Descending');
  await skip(page, '01:10');
  await page.waitForURL('**/landing');
  await page.clock.resume();
  await expect(page.getByRole('heading', { name: 'Welcome to Portland' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Flight summary' })).toContainText('40 min');
  await noSidewaysScroll(page);
  await page.getByRole('link', { name: 'Flight log' }).click();
  await expect(page.getByRole('region', { name: 'Past flights' })).toContainText('Landed');
  await page.getByRole('link', { name: 'Passport' }).click();
  await expect(page.getByRole('img', { name: /Passport stamp: Portland/ })).toBeVisible();
});

test('a diverted flight adds a log entry only', async ({ page }) => {
  await start(page);
  await bookAndBoard(page, 'SFO', '14C'); // aisle
  await skip(page, '40:00');
  await page.getByRole('button', { name: 'Delay 10 min' }).click();
  await page.clock.runFor(1000);
  await expect(page.getByRole('button', { name: 'Already delayed' })).toBeDisabled();
  await page.getByRole('button', { name: 'Divert' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('40 focused minutes');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Divert' }).click();
  await dialog.getByRole('button', { name: 'Divert' }).click();
  await page.waitForURL('**/landing');
  await page.clock.resume();
  await expect(page.getByRole('heading', { name: 'Flight diverted' })).toBeVisible();
  await page.getByRole('link', { name: 'Flight log' }).click();
  await expect(page.getByRole('region', { name: 'Past flights' })).toContainText('Diverted');
  await page.getByRole('link', { name: 'Passport' }).click();
  await expect(page.getByText(/^0 of [\d,]+ airports$/i)).toBeVisible();
  await expect(page.getByRole('img', { name: /Passport stamp/ })).toHaveCount(0);
});

test('exit row: divert needs a 10 second hold', async ({ page }) => {
  await start(page);
  await bookAndBoard(page, 'SFO', '12A');
  await skip(page, '30:00');
  await page.getByRole('button', { name: 'Divert' }).click();
  const hold = page.getByRole('button', { name: /Hold for 10 seconds/ });
  await hold.dispatchEvent('pointerdown');
  await page.clock.runFor(4000);
  await hold.dispatchEvent('pointerup');
  await page.clock.runFor(500);
  expect(new URL(page.url()).pathname).toBe('/flight');
  await hold.dispatchEvent('pointerdown');
  await page.clock.runFor(10_500);
  await page.waitForURL('**/landing');
});

test('keyboard only: book, pick a seat with the arrow keys, board and divert', async ({ page, isMobile }, info) => {
  test.skip(info.project.name === 'mobile', 'keyboard run-through is a desktop check');
  void isMobile;
  await page.clock.install({ time: T0 });
  await page.goto('/');
  await page.getByRole('button', { name: /Guest Pass/ }).focus();
  await page.keyboard.press('Enter');
  await page.waitForURL('**/book');
  await page.getByLabel('To', { exact: true }).focus();
  await page.keyboard.type('pdx');
  await page.getByRole('option').first().waitFor();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /Choose your seat/ }).focus();
  await page.keyboard.press('Enter');
  await page.waitForURL('**/seat');
  await page.getByRole('button', { name: 'Seat 14A, window' }).focus();
  await page.keyboard.press('ArrowDown'); // towards F
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft'); // towards the nose
  await expect(page.getByRole('button', { name: 'Seat 13C, aisle' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Seat 13C, aisle' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Confirm seat 13C' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Board flight' }).first().focus();
  await page.keyboard.press('Enter');
  await page.waitForURL('**/flight');
  await skip(page, '05:00');
  await page.getByRole('button', { name: 'Divert' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Stay on board' })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.waitForURL('**/landing');
});

test('works offline once installed: book, fly and land with no network', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now controlled by the service worker
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.clock.install({ time: T0 });
  await page.reload();
  await page.getByRole('button', { name: /Guest Pass/ }).click();
  await bookAndBoard(page, 'PDX', '12A');
  await page.clock.runFor(1500);
  await expect(page.locator('[data-map=fallback]')).toBeVisible();
  await skip(page, '45:10');
  await page.waitForURL('**/landing');
  await page.clock.resume();
  await expect(page.getByRole('heading', { name: 'Welcome to Portland' })).toBeVisible();
});

test('no serious accessibility violations on any screen', async ({ page }) => {
  const check = async (name: string) => {
    const r = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .exclude('.maplibregl-map')
      .analyze();
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${name}: ${v.id} — ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
  };
  await page.goto('/');
  await page.waitForTimeout(1500); // split-flap finishes
  await check('terminal');
  await page.getByRole('button', { name: /Guest Pass/ }).click();
  await chooseDestination(page, 'PDX');
  await check('booking');
  await page.getByRole('button', { name: /Choose your seat/ }).click();
  await check('seat');
  await page.getByRole('button', { name: 'Confirm seat 14A' }).click();
  await expect(page.getByRole('article')).toBeVisible();
  await page.waitForTimeout(1200);
  await check('boarding pass');
  await page.getByRole('button', { name: 'Board flight' }).first().click();
  await page.waitForURL('**/flight');
  await page.waitForTimeout(800);
  await check('in flight');
  await page.getByRole('button', { name: 'Divert' }).click();
  await page.waitForTimeout(500); // fade-in finishes
  await check('divert dialog');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Divert' }).click();
  await page.waitForURL('**/landing');
  await page.waitForTimeout(800);
  await check('landing');
  await page.getByRole('link', { name: 'Passport' }).click();
  await check('passport');
  await page.getByRole('link', { name: 'Flight log' }).click();
  await check('flight log');
});

test('cabin cues play at boarding, meal service, seatbelt and landing', async ({ page }) => {
  // Count the tones the mixer starts.
  await page.addInitScript(() => {
    const w = window as unknown as { __tones: number };
    w.__tones = 0;
    const make = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (...args) {
      w.__tones++;
      return make.apply(this, args);
    };
  });
  const tones = () => page.evaluate(() => (window as unknown as { __tones: number }).__tones);
  await start(page);
  await bookAndBoard(page, 'PDX', '14A', 'Beverage Service · 5 min');
  await page.clock.runFor(1500);
  const boarded = await tones();
  expect(boarded).toBeGreaterThan(0); // door + seatbelt sign
  await skip(page, '10:00'); // climbing
  await skip(page, '05:00'); // climb → cruise: sign off
  const cruising = await tones();
  expect(cruising).toBeGreaterThan(boarded);
  await skip(page, '05:30'); // meal service starts
  const meal = await tones();
  expect(meal).toBeGreaterThan(cruising);
  await skip(page, '05:00'); // meal ends: chime + seatbelt sign
  const over = await tones();
  expect(over).toBeGreaterThan(meal);
  await page.getByRole('button', { name: 'Fasten seatbelt' }).click(); // buckle
  await page.clock.runFor(500);
  const buckled = await tones();
  expect(buckled).toBeGreaterThan(over);
  await skip(page, '05:00'); // descent: sign on
  const descending = await tones();
  expect(descending).toBeGreaterThan(buckled);
  await skip(page, '15:30'); // touchdown + arrival chime
  await page.waitForURL('**/landing');
  expect(await tones()).toBeGreaterThan(descending);
});

test('sign-in is a separate email and password page with no Google', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Google/ })).toHaveCount(0);
  await expect(page.getByPlaceholder('Password')).toHaveCount(0);
  await page.getByRole('link', { name: 'Continue to sign in' }).click();
  await page.waitForURL('**/signin');
  await expect(page.getByPlaceholder('Email')).toBeVisible();
  await expect(page.getByPlaceholder(/Password/)).toBeVisible();
  await expect(page.getByText(/Google|Apple/)).toHaveCount(0);
  await page.getByRole('link', { name: 'Back' }).click();
  await page.waitForURL((u) => !u.pathname.endsWith('/signin'));
});

test('the crew announces each stage of the flight, and the switch silences it', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __said: string[] };
    w.__said = [];
    SpeechSynthesis.prototype.speak = function (u: SpeechSynthesisUtterance) {
      w.__said.push(u.text);
    };
  });
  const said = () => page.evaluate(() => (window as unknown as { __said: string[] }).__said);
  await start(page);
  await bookAndBoard(page, 'PDX', '14A', 'Beverage Service · 5 min');
  await page.clock.runFor(4000);
  expect((await said()).at(-1)).toMatch(/^Welcome aboard AeroFocus flight A X \d{3} to Portland\. Our flight time is 45 minutes/);
  await skip(page, '10:00');
  await skip(page, '05:00');
  await page.clock.runFor(2000);
  expect((await said()).at(-1)).toContain('cruising altitude');
  await skip(page, '05:00');
  await page.clock.runFor(2000);
  expect((await said()).at(-1)).toBe('Meal service is now beginning. Please take a break for the next 5 minutes.');
  await skip(page, '05:00');
  await page.clock.runFor(3500);
  expect((await said()).at(-1)).toContain('Please fasten your seatbelt');
  // Turn announcements off: descent and landing stay silent.
  if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Cabin audio' }).click();
  await page.getByRole('switch', { name: 'Crew announcements' }).click();
  if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Close' }).click();
  const before = (await said()).length;
  await page.getByRole('button', { name: 'Fasten seatbelt' }).click();
  await skip(page, '05:00');
  await skip(page, '15:30');
  await page.waitForURL('**/landing');
  await page.clock.runFor(7000);
  expect((await said()).length).toBe(before);
});
