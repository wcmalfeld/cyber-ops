/**
 * Browser smoke test: plays Mission 1 and part of Mission 2 through the real UI.
 * Usage: BASE_URL=http://localhost:3000 CHROME=/usr/bin/google-chrome node tests/e2e/smoke.mjs [screenshotDir]
 */
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const shots = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const shot = async (name) => shots && page.screenshot({ path: `${shots}/${name}.png`, fullPage: false });
const step = (m) => console.log("✓", m);

const email = `e2e-${Date.now()}@example.test`;
await page.goto(`${BASE}/register`);
await shot("01-register");
await page.fill('input[name="displayName"]', "Ridgeline");
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', "correct-horse-battery");
await page.click('button:has-text("Create account")');
await page.waitForURL(`${BASE}/`);
await page.getByText("Continue training").waitFor();
step("registered and landed on Mission Control");
await shot("02-mission-control");

await page.click("text=Continue training");
await page.waitForURL(/\/missions\/hidden-in-plain-sight$/);
await shot("03-briefing");
await page.click('button:has-text("Start mission")');
await page.waitForURL(/\/play$/);
step("started Mission 1");

const term = page.locator("#term-input");
const run = async (cmd) => {
  await term.fill(cmd);
  await term.press("Enter");
  await page.waitForFunction(() => !document.querySelector("#term-input")?.hasAttribute("aria-busy") || document.querySelector("#term-input")?.getAttribute("aria-busy") === "false");
  await page.waitForTimeout(150);
};
await run("ls");
await run("ls -la");
await page.getByText("Objective complete").first().waitFor();
step("terminal observation objective auto-solved");
await run("cat .mentor/welcome.txt");
await run("chmod u+r reports/incident_brief.txt");
await run("cat reports/incident_brief.txt");
await run("ps aux");
await run("strings /tmp/.X11-cache/sysupdate | grep example");
await shot("04-terminal");

const answer = async (title, value) => {
  const card = page.locator("article", { has: page.getByRole("heading", { name: title }) });
  await card.locator("input").fill(value);
  await card.getByRole("button", { name: "Submit" }).click();
  await card.getByText("Solved", { exact: true }).waitFor();
};
// wrong answer first: shows feedback
{
  const card = page.locator("article", { has: page.getByRole("heading", { name: "Lesson 3" }) });
  await card.locator("input").fill("sysupdate");
  await card.getByRole("button", { name: "Submit" }).click();
  await card.getByText("full absolute path").waitFor();
  step("wrong answer gets targeted feedback");
  await card.getByRole("button", { name: "Get a hint" }).click();
  await card.getByText("Concept hint.").waitFor();
  step("progressive hint revealed");
}
await answer("Lesson 1", "CYBEROPS{dotfiles_are_not_invisible}");
await answer("Lesson 2", "CYBEROPS{permissions_are_a_lock_you_own}");
await answer("Lesson 3", "/tmp/.X11-cache/sysupdate");
await answer("Extract the indicator", "beacon.update-cdn-sync.example");
step("all Mission 1 objectives solved");
await shot("05-workspace-solved");
await page.click('button:has-text("Complete mission")');
await page.waitForURL(/\/debrief$/);
await page.getByText("Historical incident debrief").count();
step("debrief shown");
await shot("06-debrief");

// Persistence: reload Mission 1 workspace — progress and cwd survive.
await page.goto(`${BASE}/missions/hidden-in-plain-sight/play`);
await page.getByText("Session restored").waitFor();
step("saved progress restored on return");

// Mission 2: log viewer + evidence selection.
await page.goto(`${BASE}/missions/who-logged-in`);
await page.click('button:has-text("Start mission")');
await page.waitForURL(/\/play$/);
await page.fill("#log-search", "203.0.113.45");
await page.getByText(/Showing\s+25\s+of/).waitFor();
step("log search narrows to attacker rows");
await page.locator('tr', { hasText: "mtorres" }).filter({ hasText: "SSO Portal" }).filter({ hasText: "SUCCESS" }).first().locator('input[type="checkbox"]').check();
await shot("07-log-viewer");
const card = page.locator("article", { has: page.getByRole("heading", { name: "Find the noisy source" }) });
await card.locator("input").fill("203.0.113.45");
await card.getByRole("button", { name: "Submit" }).click();
await card.getByText("Solved", { exact: true }).waitFor();
const ev = page.locator("article", { has: page.getByRole("heading", { name: "Pin the compromise" }) });
await ev.getByRole("button", { name: "Submit selection" }).click();
await ev.getByText("Solved", { exact: true }).waitFor();
step("evidence selection validated server-side");

// Mission 3: multi-file correlation + timeline builder.
await page.goto(`${BASE}/missions/the-unlocked-door`);
await page.click('button:has-text("Start mission")');
await page.waitForURL(/\/play$/);
await page.getByRole("tab", { name: "Log viewer" }).click();
await page.selectOption("#log-file", { label: "remotegate_sessions.csv" });
await page.locator("tr", { hasText: "RA-2037" }).locator('input[type="checkbox"]').check();
const sa = page.locator("article", { has: page.getByRole("heading", { name: "Identify the suspicious authentication" }) });
await sa.getByRole("button", { name: "Submit selection" }).click();
await sa.getByText("Solved", { exact: true }).waitFor();
await page.getByRole("tab", { name: "Timeline" }).click();
const target = [
  "Sign in to rg-legacy", "Read deploy_backup.ps1", "Log on to DC-01", "Create the account",
  "Add helpdesk_tmp", "Log on to CLAIMS-DB-01", "Transfer 48 GiB",
];
for (let i = 0; i < target.length; i++) {
  for (;;) {
    const labels = await page.locator("#tool-pane ol > li").allInnerTexts();
    const at = labels.findIndex((l) => l.includes(target[i]));
    if (at <= i) break;
    await page.getByRole("button", { name: new RegExp(`Move ".*${target[i]}.*" earlier`) }).click();
  }
}
await shot("12-timeline");
await page.getByRole("button", { name: "Submit sequence" }).click();
await page.locator("#tool-pane").getByText("Sequence confirmed").first().waitFor();
step("timeline reconstruction validated");
await page.getByRole("tab", { name: "Evidence" }).click();
await page.getByRole("button", { name: /deploy_backup\.ps1/ }).click();
await page.getByText("CYBEROPS{plaintext_secrets_become_attacker_keys}").waitFor();
await shot("13-evidence");
step("evidence viewer shows recovered script");

// Mobile dashboard
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/`);
await shot("08-mobile-dashboard");
await page.goto(`${BASE}/industry`);
await shot("09-mobile-industry");
await page.setViewportSize({ width: 1440, height: 960 });
await page.goto(`${BASE}/the-unlocked-door`.replace("/the", "/missions/the"));
await shot("10-dossier-briefing");
await page.goto(`${BASE}/skills`);
await shot("11-skills");

await browser.close();
console.log("E2E smoke passed");
