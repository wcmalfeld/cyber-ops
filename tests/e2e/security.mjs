/** Security smoke: answer leakage in rendered pages + API guards. Run against a live server: node tests/e2e/security.mjs */
import { chromium } from "playwright-core";
const B = process.env.BASE_URL ?? "http://localhost:3000";
const br = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const ctx = await br.newContext(); const page = await ctx.newPage();
await page.goto(`${B}/register`);
await page.fill('input[name="displayName"]', "Leakcheck");
await page.fill('input[name="email"]', `leak-${Date.now()}@example.test`);
await page.fill('input[name="password"]', "correct-horse-battery");
await page.click('button:has-text("Create account")'); await page.waitForURL(`${B}/`);
const secrets = ["CYBEROPS{dotfiles","CYBEROPS{permissions","CYBEROPS{plaintext","beacon.update-cdn-sync","Summ3r-Backup","mtorres","correctOrder","\"accept\"","whyWrong","RA-2037\"]"];
const req = ctx.request;
for (const m of ["hidden-in-plain-sight","who-logged-in","the-unlocked-door"]) await req.post(`${B}/api/missions/${m}/start`, { headers: { "Content-Type":"application/json", Origin: B }, data: {} });
for (const path of ["/", "/paths", "/missions/hidden-in-plain-sight", "/missions/hidden-in-plain-sight/play", "/missions/who-logged-in/play", "/missions/the-unlocked-door", "/missions/the-unlocked-door/play", "/skills", "/career"]) {
  const html = await (await req.get(B + path)).text();
  const hits = secrets.filter((s) => html.includes(s));
  console.log(path.padEnd(42), hits.length ? "LEAK " + hits.join(", ") : "clean");
}
const post = (p, data, headers = {}) => req.post(B + p, { headers: { "Content-Type": "application/json", Origin: B, ...headers }, data });
console.log("debrief before completion ->", new URL((await req.get(`${B}/missions/who-logged-in/debrief`)).url()).pathname);
console.log("cross-origin submit ->", (await post("/api/missions/who-logged-in/tasks/attacker-ip/submit", { kind: "text", value: "x" }, { Origin: "https://evil.example" })).status());
console.log("forged completion ->", (await post("/api/missions/who-logged-in/complete", { allSolved: true })).status());
console.log("wrong-type body ->", (await post("/api/missions/who-logged-in/tasks/attacker-ip/submit", { kind: "text", value: 5 })).status());
const anon = await (await br.newContext()).request.post(`${B}/api/missions/who-logged-in/complete`, { headers: { "Content-Type":"application/json", Origin: B }, data: {} });
console.log("unauthenticated ->", anon.status());
let codes = []; for (let i = 0; i < 22; i++) codes.push((await post("/api/missions/who-logged-in/tasks/attacker-ip/submit", { kind: "text", value: "guess" + i })).status());
console.log("rapid guessing ->", [...new Set(codes)].join(","), "(429 after", codes.indexOf(429), "requests)");
await br.close();
