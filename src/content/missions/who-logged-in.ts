import type { MissionInput } from "@/engine/schema";

/**
 * Synthetic SSO log for Mesa Ridge Credit Union (fictional). Generated deterministically
 * so the dataset — and the answers derived from it — never drift between builds.
 * All IPs are RFC 1918 or RFC 5737 documentation ranges.
 */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EMPLOYEES = [
  "mtorres", "jchen", "aokafor", "bnguyen", "cdavis", "dkim", "egarcia", "fwilliams",
  "gpatel", "hlopez", "imorgan", "jreyes", "kpatel", "lbrooks", "mschmidt", "nward",
];
const NONEXISTENT = ["admin", "administrator", "test", "helpdesk", "scanner", "backup", "svc_sso"];
const ATTACKER_IP = "203.0.113.45";
const BROWSERS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) Safari/18.1",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/141.0",
];
const APPS = ["SSO Portal", "Core Banking", "Email", "HR Portal", "Payroll"];

interface Row {
  ts: string;
  user: string;
  ip: string;
  country: string;
  city: string;
  result: "SUCCESS" | "FAILURE";
  reason: string;
  app: string;
  ua: string;
}

function iso(day: number, h: number, m: number, s: number) {
  return `2026-10-${String(day).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}Z`;
}

export const SPRAY_ORDER_BEFORE_SUCCESS = [
  "admin", "jchen", "administrator", "aokafor", "bnguyen", "test", "cdavis", "dkim",
  "helpdesk", "egarcia", "fwilliams", "gpatel", "scanner", "hlopez", "imorgan", "jreyes", "backup",
];
export const SPRAY_ORDER_AFTER_SUCCESS = ["kpatel", "lbrooks", "svc_sso", "mschmidt", "nward", "administrator"];

function buildRows(): Row[] {
  const rand = prng(20261014);
  const rows: Row[] = [];
  const homeIp: Record<string, string> = {};
  EMPLOYEES.forEach((u, i) => (homeIp[u] = `198.51.100.${20 + i}`));

  // Normal business days, 14–15 Oct (07:00–17:00 Denver = 13:00–23:00 UTC).
  for (const day of [14, 15]) {
    for (const u of EMPLOYEES) {
      const sessions = 1 + Math.floor(rand() * 2);
      for (let s = 0; s < sessions; s++) {
        const h = 13 + Math.floor(rand() * 9);
        const m = Math.floor(rand() * 60);
        const onVpn = rand() < 0.55;
        const ip = onVpn ? `10.20.${4 + (EMPLOYEES.indexOf(u) % 3)}.${30 + EMPLOYEES.indexOf(u)}` : homeIp[u];
        const ua = BROWSERS[EMPLOYEES.indexOf(u) % BROWSERS.length];
        if (rand() < 0.12) {
          rows.push({ ts: iso(day, h, m, Math.floor(rand() * 30)), user: u, ip, country: "US", city: "Denver", result: "FAILURE", reason: "bad_password", app: "SSO Portal", ua });
        }
        rows.push({ ts: iso(day, h, m, 30 + Math.floor(rand() * 29)), user: u, ip, country: "US", city: "Denver", result: "SUCCESS", reason: "mfa_push_approved", app: APPS[Math.floor(rand() * APPS.length)], ua });
      }
    }
  }

  // Legitimate but unusual: kpatel travelling to Chicago, passes MFA normally.
  rows.push({ ts: iso(15, 14, 2, 11), user: "kpatel", ip: "192.0.2.88", country: "US", city: "Chicago", result: "FAILURE", reason: "bad_password", app: "SSO Portal", ua: BROWSERS[0] });
  rows.push({ ts: iso(15, 14, 2, 49), user: "kpatel", ip: "192.0.2.88", country: "US", city: "Chicago", result: "SUCCESS", reason: "mfa_push_approved", app: "Email", ua: BROWSERS[0] });

  // The attack: 16 Oct, ~02:00 Denver (08:00 UTC). One attempt per username, fixed cadence.
  const attacker = { ip: ATTACKER_IP, country: "NL", city: "Amsterdam", app: "SSO Portal", ua: "python-requests/2.32.3" };
  let t = 8 * 3600 + 2 * 60 + 5;
  const at = () => {
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    t += 37;
    return iso(16, h, m, s);
  };
  for (const u of SPRAY_ORDER_BEFORE_SUCCESS)
    rows.push({ ts: at(), user: u, ...attacker, result: "FAILURE", reason: NONEXISTENT.includes(u) ? "unknown_user" : "bad_password" });
  rows.push({ ts: at(), user: "mtorres", ...attacker, result: "SUCCESS", reason: "password_ok; mfa_not_enrolled" });
  for (const u of SPRAY_ORDER_AFTER_SUCCESS)
    rows.push({ ts: at(), user: u, ...attacker, result: "FAILURE", reason: NONEXISTENT.includes(u) ? "unknown_user" : "bad_password" });
  // Post-compromise: the session is used against Payroll.
  rows.push({ ts: iso(16, 8, 19, 2), user: "mtorres", ...attacker, app: "Payroll", ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0", result: "SUCCESS", reason: "sso_session" });
  // mtorres' real login next morning from home.
  rows.push({ ts: iso(16, 14, 40, 3), user: "mtorres", ip: "198.51.100.20", country: "US", city: "Denver", result: "SUCCESS", reason: "password_ok; mfa_not_enrolled", app: "Email", ua: BROWSERS[0] });

  return rows.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
}

const rows = buildRows();
const header = "event_id,timestamp,user,src_ip,country,city,result,reason,app,user_agent";
const csv =
  header +
  "\n" +
  rows
    .map((r, i) => [`EVT-${String(1000 + i)}`, r.ts, r.user, r.ip, r.country, r.city, r.result, `"${r.reason}"`, r.app, `"${r.ua}"`].join(","))
    .join("\n") +
  "\n";

const successIndex = rows.findIndex((r) => r.user === "mtorres" && r.ip === ATTACKER_IP && r.app === "SSO Portal");
export const ATTACK_SUCCESS_EVENT_ID = `EVT-${1000 + successIndex}`;
export const ATTACKER_FAILURE_COUNT = rows.filter((r) => r.ip === ATTACKER_IP && r.result === "FAILURE").length;

export const whoLoggedIn: MissionInput = {
  id: "who-logged-in",
  version: 1,
  title: "Who Logged In?",
  codename: "OP-0002",
  summary:
    "An overnight burst of failed logins hit the credit union's single sign-on portal. Most of them failed. Find the one that didn't.",
  category: "soc",
  path: "soc",
  difficulty: "easy",
  level: 1,
  estimatedMinutes: 25,
  learningObjectives: [
    "Read authentication logs: timestamps, source IPs, results and reasons",
    "Filter and sort a log to isolate one actor's activity",
    "Distinguish password spraying from brute force and other techniques",
    "Separate a genuinely suspicious login from merely unusual ones",
    "Connect a successful compromise to the missing control that allowed it",
  ],
  companyIds: ["radicl", "enzoic"],
  recommendedAfter: ["hidden-in-plain-sight"],
  briefing: {
    organization: "Mesa Ridge Credit Union (fictional) — a Front Range credit union in the CYBER OPS training ecosystem",
    role: "Tier 1 SOC analyst on the morning shift",
    situation: [
      "The overnight SIEM rule 'Excessive SSO failures' fired at 08:15 UTC on 16 Oct and was auto-closed as noise. Your lead wants a second look.",
      "You have one artifact: an export of the SSO identity provider's authentication log covering 14–16 October.",
      "Determine whether any account was actually accessed, by whom, and how. Timestamps are UTC; the credit union operates on Denver time (UTC−6 in October).",
    ],
    glossary: [
      { term: "SSO (single sign-on)", definition: "One login that grants access to many applications. Compromising an SSO account often means compromising everything behind it." },
      { term: "Source IP", definition: "The address a login came from. 10.x addresses here are the corporate VPN; 198.51.100.x are employees' home ISPs." },
      { term: "MFA (multi-factor authentication)", definition: "A second proof of identity beyond the password — here a push notification. `mfa_not_enrolled` means the account never set one up." },
      { term: "Password spraying", definition: "Trying one or a few common passwords against many accounts, slowly, to avoid per-account lockouts." },
      { term: "Brute force", definition: "Trying many passwords against one account until one works." },
      { term: "UTC", definition: "Coordinated Universal Time. Logs use it so events from different time zones line up." },
    ],
  },
  tools: ["log_viewer"],
  evidence: [
    {
      id: "sso-auth",
      name: "sso_auth_2026-10-14_16.csv",
      format: "csv",
      description: "Identity provider authentication events, 14–16 Oct 2026, exported from the SIEM.",
      source: "Mesa Ridge SSO identity provider",
      content: csv,
      rowIdColumn: "event_id",
      timestampColumn: "timestamp",
    },
  ],
  tasks: [
    {
      id: "attacker-ip",
      kind: "text",
      title: "Find the noisy source",
      prompt: "Which source IP address generated the overnight burst of failed logins?",
      placeholder: "e.g. 192.0.2.1",
      xp: 75,
      skills: [{ skill: "networking", weight: 1 }, { skill: "threat_hunting", weight: 1 }],
      accept: [ATTACKER_IP],
      feedback: [
        { match: "192.0.2.88", message: "That address belongs to a single user's travel login. Look for one address hitting many accounts." },
      ],
      hints: [
        "An attack against many accounts usually comes from somewhere none of your employees are.",
        "Focus on FAILURE results, and look at the hours when the credit union is closed.",
        "Filter the log to result = FAILURE, then sort by src_ip or timestamp.",
        "Filter FAILURE and look at 16 Oct around 08:00 UTC — one IP repeats on every row.",
      ],
      solution: `Filtering to FAILURE shows a run of events on 16 Oct from 08:02 UTC, all from ${ATTACKER_IP} (Amsterdam), each targeting a different username with user agent python-requests.`,
      explanation:
        "A single external address, a scripting-library user agent, a fixed cadence and 02:00 local time together are a strong automated-attack signature.",
    },
    {
      id: "attempt-count",
      kind: "text",
      title: "Measure the campaign",
      prompt: "How many failed login attempts did that IP address generate in the entire log?",
      placeholder: "a number",
      xp: 75,
      requires: ["attacker-ip"],
      skills: [{ skill: "threat_hunting", weight: 1 }],
      accept: [String(ATTACKER_FAILURE_COUNT)],
      feedback: [
        { match: String(SPRAY_ORDER_BEFORE_SUCCESS.length), message: "That's the count before the attacker got in. The question asks for every failure from that address — did it stop after succeeding?" },
        { match: String(ATTACKER_FAILURE_COUNT + 1), message: "Close. Count only FAILURE results — one of that IP's events succeeded." },
      ],
      hints: [
        "Counting by hand is error-prone. Let the tool do it.",
        "You need two conditions at once: the attacker's IP and a FAILURE result.",
        "Combine filters in the log viewer — the row count updates as you filter.",
        `Filter src_ip = ${ATTACKER_IP} and result = FAILURE, then read the matching row count.`,
      ],
      solution: `With src_ip=${ATTACKER_IP} and result=FAILURE the viewer shows ${ATTACKER_FAILURE_COUNT} rows: ${SPRAY_ORDER_BEFORE_SUCCESS.length} before the successful login and ${SPRAY_ORDER_AFTER_SUCCESS.length} after — the script kept running.`,
      explanation:
        "Scoping the campaign matters: every username it tried is now a known target, and the attempts that continued after success show an automated tool working through a list.",
    },
    {
      id: "breach-event",
      kind: "evidence_select",
      title: "Pin the compromise",
      prompt: "In the log viewer, mark the single event where the attacker first successfully authenticated, then submit your selection.",
      xp: 125,
      requires: ["attacker-ip"],
      skills: [{ skill: "incident_response", weight: 1 }, { skill: "identity_management", weight: 1 }],
      evidenceId: "sso-auth",
      required: [ATTACK_SUCCESS_EVENT_ID],
      maxSelections: 2,
      hints: [
        "Most of the campaign failed. The interesting row is the exception.",
        "Within the attacker's activity, look for a different result.",
        "Filter to the attacker's IP and look for result = SUCCESS. Check the app column too.",
        "There are two SUCCESS rows from that IP. The first one is the SSO Portal login; the second is what they did with it.",
      ],
      solution: `${ATTACK_SUCCESS_EVENT_ID}: mtorres, ${ATTACKER_IP}, SSO Portal, SUCCESS, reason 'password_ok; mfa_not_enrolled'. Six minutes later the same session reached Payroll.`,
      explanation:
        "Selecting the decisive event — not every event — is the skill. An escalation that says 'EVT-x is the initial access' is actionable; a dump of 200 rows is not.",
    },
    {
      id: "compromised-account",
      kind: "text",
      title: "Name the account",
      prompt: "Which user account was compromised?",
      placeholder: "username",
      xp: 75,
      requires: ["breach-event"],
      skills: [{ skill: "identity_management", weight: 1 }],
      accept: ["mtorres"],
      feedback: [
        { match: "kpatel", message: "kpatel's Chicago login is unusual, but it passed MFA from the user's normal browser. Unusual isn't the same as malicious." },
        { match: "admin", message: "'admin' doesn't exist here — the reason column says unknown_user." },
      ],
      hints: [
        "You've already found the event.",
        "Which user does that row belong to?",
        "Read the user column of the row you marked.",
        "It's the only real account that succeeded from the attacker's IP.",
      ],
      solution: "mtorres. The login succeeded with password alone because the account had never enrolled in MFA.",
      explanation: "Identifying the account drives containment: revoke its sessions, reset its credentials, review everything it touched.",
    },
    {
      id: "technique",
      kind: "choice",
      title: "Classify the attack",
      prompt: "Which technique best describes the attacker's login activity?",
      xp: 100,
      requires: ["attacker-ip"],
      skills: [{ skill: "threat_hunting", weight: 1 }, { skill: "identity_management", weight: 0.5 }],
      options: [
        { id: "spray", label: "Password spraying (MITRE T1110.003)" },
        { id: "brute", label: "Brute force against a single account (T1110.001)", whyWrong: "Brute force hammers one account with many passwords. Here each username received about one attempt." },
        { id: "mfa-fatigue", label: "MFA fatigue / push bombing (T1621)", whyWrong: "There are no MFA push events in the attack. The successful login didn't involve MFA at all." },
        { id: "token-theft", label: "Stolen session token replay (T1550.004)", whyWrong: "Token replay doesn't generate password failures. This activity tried passwords against many accounts." },
      ],
      correct: ["spray"],
      hints: [
        "Look at the shape of the attack, not just its volume.",
        "Count how many attempts each username received from the attacker.",
        "One password against many users, or many passwords against one user?",
        "Each username appears roughly once, at a steady interval, including nonexistent names like 'admin' and 'test'.",
      ],
      solution: "Password spraying: one attempt per username across a list (including guesses like admin/test), at a steady 37-second cadence to stay under lockout thresholds.",
      explanation:
        "Spraying evades per-account lockout because no single account sees many failures. Detection has to aggregate by source and across accounts — exactly what the auto-closed SIEM rule was trying to do.",
    },
    {
      id: "missing-control",
      kind: "choice",
      title: "Find the gap",
      prompt: "Which control would most directly have prevented this login from succeeding?",
      xp: 100,
      requires: ["compromised-account"],
      skills: [{ skill: "identity_management", weight: 1.5 }],
      options: [
        { id: "mfa", label: "Enforce MFA enrollment for every account before SSO access" },
        { id: "geo", label: "Block logins from outside the United States", whyWrong: "Helpful as a signal, but attackers routinely route through local exits. The decisive gap is that a password alone was enough." },
        { id: "complexity", label: "Increase minimum password length", whyWrong: "Helps against guessing, but sprayed passwords are chosen to satisfy complexity rules (e.g. 'Autumn2026!')." },
        { id: "timeout", label: "Shorter session timeouts", whyWrong: "Timeouts limit how long a session lasts; they don't stop the login." },
      ],
      correct: ["mfa"],
      hints: [
        "What made mtorres different from every other account the attacker tried?",
        "Read the reason column on the successful login carefully.",
        "The reason says the password was correct — and something else.",
        "mfa_not_enrolled: the only barrier was a password.",
      ],
      solution: "Enforce MFA enrollment. Every other employee's logins show mfa_push_approved; mtorres' shows mfa_not_enrolled, so one guessed password granted full access.",
      explanation:
        "Spraying succeeds statistically — eventually someone uses a common password. MFA turns a correct guess into a dead end. Enrollment gaps are among the most common root causes in account-takeover incidents.",
    },
  ],
  completionXp: 150,
  debrief: {
    summary: `You turned an auto-closed alert into a confirmed account compromise: ${ATTACKER_IP} made ${ATTACKER_FAILURE_COUNT + 1} automated login attempts overnight, guessed mtorres' password, and — because mtorres had no MFA — reached Payroll within minutes.`,
    whatHappened:
      "At about 02:00 Denver time on 16 Oct, a Python script tried one password against a list of usernames, one every 37 seconds. Seventeen attempts failed. The eighteenth, against mtorres, succeeded. The script kept going through its list while the attacker used the new session to open Payroll.",
    whyPossible:
      "mtorres never enrolled in MFA, so the identity provider accepted a password alone. The SIEM rule that caught the burst was auto-closed, and per-account lockout never triggered because no account saw more than one failure.",
    technicalExplanation:
      "Authentication logs record who, from where, when, the result and why. Aggregating failures by source IP across accounts exposes spraying that per-account views miss. The decisive row combines an external IP, an automation user agent, off-hours timing and a reason field showing a single-factor success.",
    toolsUsed: [
      { name: "Log viewer filters", purpose: "Isolate FAILURE results and a single source IP" },
      { name: "Sorting by timestamp", purpose: "Reconstruct the order and cadence of attempts" },
      { name: "Evidence selection", purpose: "Mark the decisive initial-access event for escalation" },
    ],
    techniques: [
      { id: "T1110.003", name: "Brute Force: Password Spraying", url: "https://attack.mitre.org/techniques/T1110/003/" },
      { id: "T1078", name: "Valid Accounts", url: "https://attack.mitre.org/techniques/T1078/" },
    ],
    concepts: [
      { term: "Unusual vs. malicious", definition: "kpatel's Chicago login was unusual but consistent with normal behavior (own browser, MFA passed). Analysts must separate anomalies from threats." },
      { term: "Initial access", definition: "The first successful foothold. Everything after it is scoped relative to this event." },
      { term: "Alert fatigue", definition: "When high alert volumes lead to real detections being dismissed — here, an auto-closed rule." },
    ],
    defenses: [
      "Require MFA enrollment before granting SSO access; report on unenrolled accounts weekly.",
      "Alert on many distinct usernames failing from one source within a short window.",
      "Screen passwords against known-compromised and commonly sprayed lists at set and reset time.",
      "Revoke mtorres' sessions, reset the password, enroll MFA, and review Payroll activity after 08:19 UTC.",
      "Block 203.0.113.45 and hunt for it in other logs.",
    ],
    commonMistakes: [
      "Flagging kpatel's travel login as the compromise because it came from a new city.",
      "Counting only the failures before the success and under-scoping the campaign.",
      "Calling it brute force — the per-account pattern matters for choosing detections.",
      "Stopping at 'the password was guessed' without identifying the missing MFA enrollment.",
    ],
    resources: [
      { title: "MITRE ATT&CK: Password Spraying", publisher: "MITRE", url: "https://attack.mitre.org/techniques/T1110/003/" },
      { title: "More than a Password: Multifactor Authentication", publisher: "CISA", url: "https://www.cisa.gov/MFA" },
    ],
  },
};
