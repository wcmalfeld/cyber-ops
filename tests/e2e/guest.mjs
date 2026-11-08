/**
 * Browser test for guest play: one click to Mission 1, play, then save progress to an account.
 * Usage: BASE_URL=http://localhost:3000 CHROME=/usr/bin/google-chrome node tests/e2e/guest.mjs [screenshotDir]
 */
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const shots = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const shot = async (name) => shots && page.screenshot({ path: `${shots}/${name}.png`, fullPage: false });
const step = (m) => console.log("✓", m);

try {
  await page.goto(`${BASE}/`);
  await page.waitForURL(/\/login$/);
  await shot("guest-01-landing");
  await page.click('button:has-text("Play now as guest")');
  await page.waitForURL(/\/missions\/hidden-in-plain-sight$/);
  await page.getByText(/^Guest-[0-9A-F]{6}$/).first().waitFor();
  step("one click from landing page to the Mission 1 briefing as a guest");
  await shot("guest-02-briefing");

  await page.click('button:has-text("Start mission")');
  await page.waitForURL(/\/play$/);
  const term = page.locator("#term-input");
  await term.fill("ls -la");
  await term.press("Enter");
  await page.getByText("README.txt").first().waitFor();
  step("guest can start the mission and use the terminal");

  // A guest visiting /register is sent to the claim flow instead of creating a second account.
  await page.goto(`${BASE}/register`);
  await page.waitForURL(/\/save$/);
  await shot("guest-03-save");
  await page.fill('input[name="displayName"]', "Switchback");
  await page.fill('input[name="email"]', `guest-${Date.now()}@example.test`);
  await page.fill('input[name="password"]', "correct-horse-battery");
  await page.click('button:has-text("Save progress")');
  await page.waitForURL(`${BASE}/`);
  await page.getByText("Switchback").first().waitFor();
  await page.getByRole("button", { name: "Sign out" }).waitFor();
  step("guest saved progress to a full account");
  await shot("guest-04-saved");

  await page.goto(`${BASE}/missions/hidden-in-plain-sight`);
  await page.getByRole("button", { name: "Resume mission" }).waitFor({ timeout: 5000 });
  step("the in-progress mission carried over to the account");
} finally {
  await browser.close();
}
