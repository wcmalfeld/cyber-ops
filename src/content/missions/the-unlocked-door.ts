import type { MissionInput } from "@/engine/schema";

/*
 * Synthetic evidence for a FICTIONAL organization. The attack pattern (stolen credentials
 * → remote-access portal without MFA → privilege escalation → exfiltration) is inspired
 * by publicly reported facts of the February 2024 Change Healthcare incident. Every
 * name, host, timestamp, IP and event below is invented. See src/content/dossiers.ts
 * for the sourced historical record, which is kept separate.
 */

const remoteAccess = `event_id,timestamp,user,src_ip,geo,portal,mfa,result,session_id
RA-2031,2026-09-07T14:02:11Z,lnovak,198.51.100.61,US / Denver,rg.peakline.example,push_approved,success,S-61c0
RA-2032,2026-09-07T14:15:40Z,jkaplan,198.51.100.73,US / Aurora,rg.peakline.example,push_approved,success,S-73b2
RA-2033,2026-09-07T15:01:09Z,vendor_medicore,192.0.2.140,US / Omaha,rg-legacy.peakline.example,not_configured,success,S-40e8
RA-2034,2026-09-07T16:22:55Z,pmurphy,198.51.100.66,US / Boulder,rg.peakline.example,push_denied,failure,-
RA-2035,2026-09-07T16:23:31Z,pmurphy,198.51.100.66,US / Boulder,rg.peakline.example,push_approved,success,S-66d1
RA-2036,2026-09-07T21:47:02Z,jkaplan,198.51.100.73,US / Aurora,rg.peakline.example,push_approved,success,S-73b9
RA-2037,2026-09-08T02:41:09Z,jkaplan,198.51.100.77,Unknown / hosting provider,rg-legacy.peakline.example,not_configured,success,S-77a1
RA-2038,2026-09-08T13:58:30Z,lnovak,198.51.100.61,US / Denver,rg.peakline.example,push_approved,success,S-61c7
RA-2039,2026-09-08T14:10:12Z,jkaplan,198.51.100.73,US / Aurora,rg.peakline.example,push_approved,success,S-73c4
RA-2040,2026-09-08T15:30:48Z,vendor_medicore,192.0.2.140,US / Omaha,rg-legacy.peakline.example,not_configured,success,S-40f1
`;

const directoryEvents = `event_id,timestamp,host,account,event,target,detail
DE-5101,2026-09-07T14:16:02Z,WS-JKAPLAN-VDI,jkaplan,LOGON_SUCCESS,-,type=RemoteInteractive via rg.peakline.example
DE-5102,2026-09-07T16:24:10Z,WS-PMURPHY-VDI,pmurphy,LOGON_SUCCESS,-,type=RemoteInteractive via rg.peakline.example
DE-5103,2026-09-07T19:05:44Z,HR-PORTAL-01,tbell,LOGON_SUCCESS,-,type=Network
DE-5104,2026-09-07T20:12:00Z,MAIL-01,pmurphy,LOGON_SUCCESS,-,type=Network
DE-5105,2026-09-08T02:41:40Z,VDI-LEGACY-03,jkaplan,LOGON_SUCCESS,-,type=RemoteInteractive via rg-legacy.peakline.example session S-77a1
DE-5106,2026-09-08T02:44:18Z,FS-01,jkaplan,FILE_READ,\\\\fs-01\\it-scripts\\deploy_backup.ps1,share it-scripts readable by Domain Users
DE-5107,2026-09-08T02:45:02Z,FS-01,jkaplan,FILE_READ,\\\\fs-01\\it-scripts\\README.txt,share it-scripts readable by Domain Users
DE-5108,2026-09-08T02:51:27Z,DC-01,svc_backup,LOGON_SUCCESS,-,type=RemoteInteractive src=VDI-LEGACY-03 (service account interactive logon)
DE-5109,2026-09-08T02:58:03Z,DC-01,svc_backup,ACCOUNT_CREATED,helpdesk_tmp,created by svc_backup
DE-5110,2026-09-08T03:00:41Z,DC-01,svc_backup,GROUP_MEMBER_ADDED,helpdesk_tmp,group=Domain Admins
DE-5111,2026-09-08T03:07:19Z,CLAIMS-DB-01,helpdesk_tmp,LOGON_SUCCESS,-,type=Network src=VDI-LEGACY-03
DE-5112,2026-09-08T03:09:50Z,CLAIMS-DB-01,helpdesk_tmp,SQL_QUERY,claims_2026q3,rows_returned=2104331
DE-5113,2026-09-08T03:12:36Z,BILLING-APP-02,helpdesk_tmp,LOGON_SUCCESS,-,type=Network src=VDI-LEGACY-03
DE-5114,2026-09-08T03:20:58Z,FS-01,helpdesk_tmp,FILE_WRITE,\\\\fs-01\\staging\\claims_export_2026Q3.7z,size=48.0 GiB
DE-5115,2026-09-08T13:30:05Z,HR-PORTAL-01,tbell,LOGON_SUCCESS,-,type=Network
DE-5116,2026-09-08T14:11:00Z,WS-JKAPLAN-VDI,jkaplan,LOGON_SUCCESS,-,type=RemoteInteractive via rg.peakline.example
DE-5117,2026-09-08T14:35:12Z,MAIL-01,jkaplan,LOGON_SUCCESS,-,type=Network
`;

const networkFlows = `flow_id,timestamp,src_host,dst_ip,dst_port,proto,bytes_out,note
NF-8801,2026-09-07T23:00:02Z,FS-01,10.40.0.5,445,TCP,9663676416,nightly backup to BACKUP-01
NF-8802,2026-09-08T00:14:51Z,MAIL-01,192.0.2.25,25,TCP,18874368,outbound mail relay
NF-8803,2026-09-08T01:30:00Z,BILLING-APP-02,192.0.2.60,443,TCP,734003200,clearinghouse partner batch
NF-8804,2026-09-08T03:35:14Z,FS-01,203.0.113.200,443,TCP,51539607552,destination first seen
NF-8805,2026-09-08T13:02:40Z,MAIL-01,192.0.2.25,25,TCP,23068672,outbound mail relay
NF-8806,2026-09-08T14:30:00Z,BILLING-APP-02,192.0.2.60,443,TCP,612368384,clearinghouse partner batch
`;

const accounts = JSON.stringify(
  {
    exported_at: "2026-09-08T16:00:00Z",
    remote_access_portals: [
      { hostname: "rg.peakline.example", status: "production", mfa_required: true, allowed_groups: ["All Staff"] },
      {
        hostname: "rg-legacy.peakline.example",
        status: "scheduled for decommission (2025-Q4)",
        mfa_required: false,
        allowed_groups: ["All Staff", "Vendors"],
        note: "kept online for vendor access during migration",
      },
    ],
    accounts: [
      {
        username: "jkaplan",
        name: "Jordan Kaplan",
        title: "Revenue Cycle Analyst",
        type: "employee",
        groups: ["All Staff", "Billing Users"],
        privileged: false,
        mfa_enrolled: true,
        credential_exposure: [
          { observed: "2026-08-29", source: "infostealer log listed on a criminal marketplace (credential monitoring feed)", status: "unreviewed" },
        ],
      },
      { username: "pmurphy", name: "Pat Murphy", title: "Claims Specialist", type: "employee", groups: ["All Staff", "Claims Users"], privileged: false, mfa_enrolled: true },
      { username: "lnovak", name: "Lena Novak", title: "IT Support Engineer", type: "employee", groups: ["All Staff", "IT Support"], privileged: false, mfa_enrolled: true },
      { username: "tbell", name: "Taylor Bell", title: "HR Generalist", type: "employee", groups: ["All Staff", "HR"], privileged: false, mfa_enrolled: true },
      {
        username: "svc_backup",
        type: "service",
        owner: "IT Ops",
        groups: ["Domain Admins", "Backup Operators"],
        privileged: true,
        interactive_logon_allowed: true,
        mfa_enrolled: false,
        password_last_set: "2023-04-11",
        note: "used by nightly backup job",
      },
      { username: "vendor_medicore", type: "vendor", owner: "MediCore Billing Services (fictional)", groups: ["Vendors"], privileged: false, mfa_enrolled: false },
    ],
  },
  null,
  2,
);

const deployScript = `# deploy_backup.ps1 — nightly backup job (owner: IT Ops)
# Runs from BACKUP-01 at 23:00 via scheduled task.
#
# NOTE (2023-04): temporary hardcoded creds until the vault migration. Ticket INF-2231.
# CYBEROPS{plaintext_secrets_become_attacker_keys}

$User = "PEAKLINE\\svc_backup"
$Pass = ConvertTo-SecureString "Summ3r-Backup!23" -AsPlainText -Force
$Cred = New-Object System.Management.Automation.PSCredential($User, $Pass)

$Targets = @("CLAIMS-DB-01", "BILLING-APP-02", "FS-01")
foreach ($t in $Targets) {
    Invoke-Command -ComputerName $t -Credential $Cred -ScriptBlock { & C:\\ops\\snapshot.ps1 }
}
`;

const employeeReport = `HELPDESK TICKET HD-40912 — opened 2026-09-08 14:22 UTC
Reporter: Jordan Kaplan (jkaplan), Billing

"My account activity page shows a sign-in at 8:41 PM on Sept 7 (my time) that I don't recognize.
I was at my kid's game and didn't use my laptop. The sign-in says 'legacy portal' — I've never
used that one, I always use the normal RemoteGate link.

Possibly related: a couple of weeks ago I installed a free PDF converter on my home PC to sign
some forms. I use that PC to check work email sometimes. Antivirus flagged something afterwards
but I thought it cleaned it up."

Triage note (helpdesk): user's timezone is America/Denver (UTC-6). Escalated to SOC.
`;

export const theUnlockedDoor: MissionInput = {
  id: "the-unlocked-door",
  version: 1,
  title: "The Unlocked Door",
  codename: "DOSSIER-001",
  summary:
    "A billing analyst reports a login they didn't make. Correlate remote-access, directory and network evidence to reconstruct how one stolen password became a domain-wide breach.",
  category: "identity",
  path: "soc",
  difficulty: "medium",
  level: 1,
  estimatedMinutes: 45,
  learningObjectives: [
    "Correlate events across multiple evidence sources by time, account and session",
    "Explain why a remote-access portal without MFA turns stolen credentials into access",
    "Trace privilege escalation from a standard user to Domain Admin",
    "Scope which systems an intruder could have reached",
    "Choose containment actions that stop the attacker without destroying evidence",
  ],
  companyIds: ["enzoic", "jumpcloud"],
  dossierId: "dossier-001",
  recommendedAfter: ["who-logged-in"],
  briefing: {
    organization: "Peakline Health Exchange (fictional) — a Denver healthcare claims clearinghouse in the CYBER OPS training ecosystem",
    role: "Junior SOC analyst, day shift",
    situation: [
      "Helpdesk escalated ticket HD-40912: billing analyst Jordan Kaplan reports a sign-in they don't recognize, through a 'legacy portal' they've never used.",
      "You have exports from the remote-access gateway, the directory service, network flow monitoring, the identity inventory, and a script recovered from a file share.",
      "Determine how the account was accessed, what the attacker did with it, which systems are exposed, and what to do right now.",
    ],
    glossary: [
      { term: "Remote-access portal", definition: "A gateway that lets staff reach internal desktops from the internet. Anything that can log in to it is effectively on the internal network." },
      { term: "Infostealer", definition: "Malware that harvests saved passwords, cookies and tokens from a computer and sends them to criminals, who resell them." },
      { term: "Service account", definition: "A non-human account used by software (e.g. a backup job). Often highly privileged and rarely monitored." },
      { term: "Domain Admins", definition: "The Windows directory group with control over every domain-joined system. Membership is the 'keys to the kingdom'." },
      { term: "Lateral movement", definition: "Moving from the first compromised system to others inside the network." },
      { term: "Exfiltration", definition: "Copying data out of the organization to a system the attacker controls." },
      { term: "Containment", definition: "Stopping an active intrusion from spreading or continuing, while preserving the evidence needed to investigate it." },
    ],
  },
  tools: ["evidence_viewer", "log_viewer", "timeline_builder"],
  evidence: [
    {
      id: "employee-report",
      name: "HD-40912_ticket.txt",
      format: "txt",
      description: "The helpdesk ticket that started the investigation.",
      source: "Peakline helpdesk",
      content: employeeReport,
    },
    {
      id: "remote-access",
      name: "remotegate_sessions.csv",
      format: "csv",
      description: "Remote-access gateway authentications, 7–8 Sep 2026 (UTC).",
      source: "RemoteGate gateway (fictional)",
      content: remoteAccess,
      rowIdColumn: "event_id",
      timestampColumn: "timestamp",
    },
    {
      id: "directory-events",
      name: "directory_events.csv",
      format: "csv",
      description: "Directory and server security events: logons, file access, account and group changes.",
      source: "Peakline directory service and server audit logs",
      content: directoryEvents,
      rowIdColumn: "event_id",
      timestampColumn: "timestamp",
    },
    {
      id: "network-flows",
      name: "netflow_egress.csv",
      format: "csv",
      description: "Outbound network flows above 10 MB from server subnets.",
      source: "Perimeter flow collector",
      content: networkFlows,
      rowIdColumn: "flow_id",
      timestampColumn: "timestamp",
    },
    {
      id: "accounts",
      name: "identity_inventory.json",
      format: "json",
      description: "Identity inventory export: accounts, groups, MFA status and remote-access portal configuration.",
      source: "Peakline identity governance export",
      content: accounts,
    },
    {
      id: "deploy-script",
      name: "deploy_backup.ps1",
      format: "txt",
      description: "Script recovered from the \\\\fs-01\\it-scripts share.",
      source: "FS-01 file share",
      content: deployScript,
    },
  ],
  tasks: [
    {
      id: "suspicious-auth",
      kind: "evidence_select",
      title: "Identify the suspicious authentication",
      prompt: "In the remote-access log, mark the authentication event the reporter doesn't recognize.",
      xp: 100,
      skills: [{ skill: "identity_management", weight: 1 }, { skill: "incident_response", weight: 1 }],
      evidenceId: "remote-access",
      required: ["RA-2037"],
      maxSelections: 2,
      hints: [
        "The reporter gave you a local time and a portal name. Start from what they said.",
        "Convert the reporter's local time (America/Denver, UTC−6) to UTC, then look for their username.",
        "8:41 PM Denver on 7 Sep is 02:41 UTC on 8 Sep. Filter the remote-access log to user = jkaplan.",
        "Compare jkaplan's rows: portal, mfa, geo and src_ip. One differs on all four.",
      ],
      solution:
        "RA-2037: jkaplan at 2026-09-08T02:41:09Z from 198.51.100.77 (hosting provider) via rg-legacy.peakline.example with mfa=not_configured. Jordan's genuine sessions use rg.peakline.example from 198.51.100.73 with push MFA.",
      explanation:
        "Timezone conversion is a constant source of analyst error. The near-identical IP (.77 vs .73) is a reminder to compare fields exactly rather than by eye.",
    },
    {
      id: "access-method",
      kind: "choice",
      title: "Determine how the account was accessed",
      prompt: "Based on all the evidence, how did the attacker get into jkaplan's account?",
      xp: 100,
      requires: ["suspicious-auth"],
      skills: [{ skill: "identity_management", weight: 1 }, { skill: "threat_hunting", weight: 1 }],
      options: [
        { id: "stolen-creds", label: "Valid credentials, likely stolen by infostealer malware, used against a portal that didn't require MFA" },
        { id: "exploit", label: "A software vulnerability in the remote-access gateway", whyWrong: "The gateway recorded an ordinary, successful authentication for a real user. Exploits rarely produce clean logins." },
        { id: "brute-force", label: "Password guessing against jkaplan's account", whyWrong: "There are no failed attempts for jkaplan before the success." },
        { id: "insider", label: "Jordan Kaplan logged in deliberately and is now covering it up", whyWrong: "Jordan self-reported, the source is a hosting provider rather than their usual address, and the identity inventory shows prior credential exposure." },
      ],
      correct: ["stolen-creds"],
      hints: [
        "A clean, first-try login means the attacker already knew the password.",
        "Where might the password have come from? Re-read the ticket and the identity inventory.",
        "Look at jkaplan's entry in identity_inventory.json — especially credential_exposure — and at the legacy portal's settings.",
        "The ticket mentions malware on a home PC; the inventory shows an unreviewed infostealer exposure on 29 Aug; the legacy portal has mfa_required: false.",
      ],
      solution:
        "Stolen valid credentials. The home PC was infected after installing a fake PDF tool; jkaplan's credentials appeared in an infostealer log on 29 Aug (unreviewed); the legacy portal doesn't require MFA, so the password alone was sufficient.",
      explanation:
        "This chain — infostealer, resold credentials, single-factor remote access — is one of the most common initial-access paths. Note that jkaplan *was* enrolled in MFA; the legacy portal simply never asked.",
    },
    {
      id: "missing-control",
      kind: "choice",
      title: "Identify the missing control",
      prompt: "Which missing control made this initial access possible?",
      xp: 100,
      requires: ["access-method"],
      skills: [{ skill: "identity_management", weight: 1.5 }],
      options: [
        { id: "mfa-legacy", label: "MFA enforcement on rg-legacy.peakline.example" },
        { id: "complexity", label: "Stronger password complexity requirements", whyWrong: "The attacker had the real password. Complexity doesn't help once a password is stolen." },
        { id: "edr-servers", label: "Endpoint detection on the database servers", whyWrong: "Useful for later stages, but it wouldn't have stopped the login." },
        { id: "encryption", label: "Encryption of the claims database at rest", whyWrong: "At-rest encryption protects stolen disks, not data queried through a valid admin session." },
      ],
      correct: ["mfa-legacy"],
      hints: [
        "jkaplan has MFA enrolled. So why didn't it stop the attacker?",
        "Compare the mfa column for the two portals in the remote-access log.",
        "Check remote_access_portals in the identity inventory.",
        "rg-legacy.peakline.example: mfa_required false — kept online 'for vendor access during migration'.",
      ],
      solution: "MFA on the legacy portal. A forgotten, still-reachable access path without MFA bypassed the protection on the primary portal entirely.",
      explanation:
        "MFA protects a system only if every path into it requires MFA. Legacy and vendor access paths are where coverage gaps hide.",
    },
    {
      id: "escalation-chain",
      kind: "ordering",
      title: "Reconstruct the attack chain",
      prompt: "Put the attacker's actions in the order they happened. Use the directory events and network flows; correlate by time, host and account.",
      xp: 175,
      requires: ["suspicious-auth"],
      skills: [
        { skill: "incident_response", weight: 1.5 },
        { skill: "digital_forensics", weight: 1 },
        { skill: "windows", weight: 0.5 },
      ],
      items: [
        { id: "portal-login", label: "Sign in to rg-legacy.peakline.example as jkaplan from 198.51.100.77" },
        { id: "read-script", label: "Read deploy_backup.ps1 from the it-scripts share on FS-01" },
        { id: "svc-logon", label: "Log on to DC-01 interactively as svc_backup" },
        { id: "create-account", label: "Create the account helpdesk_tmp" },
        { id: "add-da", label: "Add helpdesk_tmp to Domain Admins" },
        { id: "query-claims", label: "Log on to CLAIMS-DB-01 and query 2.1 million claims records" },
        { id: "exfil", label: "Transfer 48 GiB from FS-01 to 203.0.113.200" },
      ],
      correctOrder: ["portal-login", "read-script", "svc-logon", "create-account", "add-da", "query-claims", "exfil"],
      hints: [
        "Privilege escalation is usually a series of small steps, each enabling the next.",
        "A standard billing user can't create Domain Admins. Which account did, and how did the attacker get it?",
        "Sort directory_events.csv by timestamp and follow session S-77a1 / host VDI-LEGACY-03 forward from 02:41 UTC.",
        "jkaplan reads the script (02:44) → svc_backup logs on (02:51) → creates helpdesk_tmp (02:58) → adds it to DA (03:00) → CLAIMS-DB-01 (03:07) → exfil flow at 03:35.",
      ],
      solution:
        "02:41 portal login (RA-2037) → 02:44 FILE_READ deploy_backup.ps1 (DE-5106) → 02:51 svc_backup interactive logon on DC-01 (DE-5108) → 02:58 ACCOUNT_CREATED helpdesk_tmp (DE-5109) → 03:00 added to Domain Admins (DE-5110) → 03:07–03:09 CLAIMS-DB-01 logon and query (DE-5111/5112) → 03:35 48 GiB egress to 203.0.113.200 (NF-8804).",
      explanation:
        "The escalation hinged on a plaintext service-account password in a share every domain user could read. Creating a fresh admin account gives an attacker persistence that survives a password reset on svc_backup.",
    },
    {
      id: "script-flag",
      kind: "flag",
      title: "Recover the planted key",
      prompt: "The artifact that enabled privilege escalation contains a flag. Submit it.",
      xp: 75,
      requires: ["escalation-chain"],
      skills: [{ skill: "application_security", weight: 0.5 }, { skill: "digital_forensics", weight: 0.5 }],
      flags: ["CYBEROPS{plaintext_secrets_become_attacker_keys}"],
      hints: [
        "Which file did the attacker read right before switching accounts?",
        "It's in your evidence list.",
        "Open deploy_backup.ps1 in the evidence viewer.",
        "Read the comment block at the top of the script.",
      ],
      solution: "deploy_backup.ps1 contains svc_backup's plaintext password and the flag CYBEROPS{plaintext_secrets_become_attacker_keys}.",
      explanation:
        "Secrets in scripts and shares are routinely found by attackers within minutes. Use a secrets vault or managed service accounts so no human-readable password exists to steal.",
    },
    {
      id: "exposed-systems",
      kind: "choice",
      title: "Scope the exposure",
      prompt: "Which systems should be treated as potentially compromised? Select all that apply.",
      xp: 125,
      requires: ["escalation-chain"],
      multi: true,
      skills: [{ skill: "incident_response", weight: 1.5 }, { skill: "threat_hunting", weight: 0.5 }],
      options: [
        { id: "vdi-legacy-03", label: "VDI-LEGACY-03" },
        { id: "dc-01", label: "DC-01" },
        { id: "claims-db-01", label: "CLAIMS-DB-01" },
        { id: "billing-app-02", label: "BILLING-APP-02" },
        { id: "fs-01", label: "FS-01" },
        { id: "hr-portal-01", label: "HR-PORTAL-01", whyWrong: "HR-PORTAL-01 shows only tbell's routine logons — no attacker account or session touched it." },
        { id: "mail-01", label: "MAIL-01", whyWrong: "MAIL-01 shows only normal staff logons and routine mail-relay flows." },
      ],
      correct: ["vdi-legacy-03", "dc-01", "claims-db-01", "billing-app-02", "fs-01"],
      hints: [
        "Exposure follows the attacker's accounts and sessions — wherever they logged on.",
        "Three identities matter: jkaplan during session S-77a1, svc_backup, and helpdesk_tmp.",
        "Filter directory_events.csv by each of those accounts after 02:41 UTC and note every host.",
        "Don't forget the machine the attacker landed on first, and the domain controller where the admin account was created.",
      ],
      solution:
        "VDI-LEGACY-03 (beachhead), DC-01 (svc_backup logon, account creation — domain-wide implications), CLAIMS-DB-01 (query), BILLING-APP-02 (logon), FS-01 (script read, staging, exfil source). HR-PORTAL-01 and MAIL-01 show no attacker activity.",
      explanation:
        "Because helpdesk_tmp is a Domain Admin, the honest answer to 'what could they reach?' is 'anything in the domain'. The list above is what they demonstrably touched — the starting point for scoping, not the end of it.",
    },
    {
      id: "containment",
      kind: "choice",
      title: "Recommend containment",
      prompt: "Select every action that belongs in the immediate containment plan.",
      xp: 150,
      requires: ["exposed-systems"],
      multi: true,
      skills: [{ skill: "incident_response", weight: 2 }, { skill: "identity_management", weight: 0.5 }],
      options: [
        { id: "disable-accounts", label: "Disable helpdesk_tmp and revoke all of jkaplan's active sessions, then reset jkaplan's password" },
        { id: "rotate-svc", label: "Reset svc_backup and rotate every credential found in scripts and shares" },
        { id: "close-portal", label: "Take rg-legacy.peakline.example offline (or enforce MFA on it) immediately" },
        { id: "isolate-preserve", label: "Network-isolate the affected hosts and capture memory and disk images before changes" },
        { id: "block-ips", label: "Block 198.51.100.77 and 203.0.113.200 at the perimeter and hunt for them elsewhere" },
        { id: "reimage-now", label: "Immediately reimage every affected server to remove the attacker", whyWrong: "Reimaging before preserving evidence destroys what you need to scope the incident. Rebuild after imaging and scoping." },
        { id: "reset-jkaplan-only", label: "Reset only jkaplan's password — that's the stolen credential", whyWrong: "The attacker now has their own Domain Admin account and svc_backup's password. Resetting jkaplan alone leaves them inside." },
        { id: "clear-logs", label: "Clear the security logs on DC-01 so the attacker can't learn what you know", whyWrong: "Clearing logs destroys your own evidence. Attackers clear logs; defenders preserve them." },
      ],
      correct: ["disable-accounts", "rotate-svc", "close-portal", "isolate-preserve", "block-ips"],
      hints: [
        "Containment has two goals at once: stop the attacker, and keep the evidence.",
        "List every way the attacker can still get in or act: accounts, credentials, access paths, network destinations.",
        "For each candidate action ask: does it remove an attacker capability? Does it destroy evidence?",
        "Five actions remove capabilities without harming evidence. Three either leave the attacker in place or destroy evidence.",
      ],
      solution:
        "Disable helpdesk_tmp and revoke jkaplan's sessions; reset svc_backup and rotate scripted credentials; close or MFA-protect the legacy portal; isolate and image affected hosts; block and hunt the two attacker IPs. Do not reimage before imaging, do not reset only one account, and never clear logs.",
      explanation:
        "Partial containment is a common and expensive mistake: if any foothold remains (the rogue admin, the service account, the open portal), the attacker returns — often with ransomware.",
    },
  ],
  completionXp: 250,
  debrief: {
    summary:
      "You reconstructed a full intrusion: an infostealer-harvested password, a forgotten portal without MFA, a plaintext service-account password, a rogue Domain Admin, and 48 GiB of claims data leaving the network — then built a containment plan that closes every foothold.",
    whatHappened:
      "On 29 Aug, jkaplan's credentials appeared in an infostealer log after malware on a home PC. At 02:41 UTC on 8 Sep the attacker signed in through the legacy portal, which didn't require MFA. They read a backup script containing svc_backup's password, used it to log on to the domain controller, created helpdesk_tmp, made it a Domain Admin, queried the claims database and exfiltrated an archive from FS-01.",
    whyPossible:
      "Three independent gaps lined up: a legacy access path without MFA, a credential-exposure alert nobody reviewed, and a privileged service account whose password sat in plaintext on a share every user could read. Closing any one of them would have broken the chain.",
    technicalExplanation:
      "Correlation is the core technique: the remote-access session id (S-77a1) and landing host (VDI-LEGACY-03) tie the gateway log to directory events; account names tie logons to account changes; host and time tie the staged archive to the egress flow. Privilege escalation used valid credentials, not an exploit — which is why it looked 'normal' to every individual system.",
    toolsUsed: [
      { name: "Log viewer", purpose: "Filter by account, sort by time, and mark the initial-access event" },
      { name: "Evidence viewer", purpose: "Read the ticket, identity inventory and recovered script" },
      { name: "Timeline builder", purpose: "Order the attack chain from correlated events" },
    ],
    techniques: [
      { id: "T1078", name: "Valid Accounts", url: "https://attack.mitre.org/techniques/T1078/" },
      { id: "T1133", name: "External Remote Services", url: "https://attack.mitre.org/techniques/T1133/" },
      { id: "T1552.001", name: "Unsecured Credentials: Credentials In Files", url: "https://attack.mitre.org/techniques/T1552/001/" },
      { id: "T1136.002", name: "Create Account: Domain Account", url: "https://attack.mitre.org/techniques/T1136/002/" },
      { id: "T1098", name: "Account Manipulation", url: "https://attack.mitre.org/techniques/T1098/" },
      { id: "T1048", name: "Exfiltration Over Alternative Protocol", url: "https://attack.mitre.org/techniques/T1048/" },
    ],
    concepts: [
      { term: "MFA coverage", definition: "MFA protects only the paths that enforce it. One unprotected path defeats it for everyone." },
      { term: "Credential exposure monitoring", definition: "Watching breach and infostealer data for your users' credentials. Only useful if alerts trigger a forced reset." },
      { term: "Least privilege for service accounts", definition: "Service accounts should have only the rights their job needs and should be denied interactive logon." },
      { term: "Persistence", definition: "A way back in that survives remediation — here, a newly created admin account." },
    ],
    defenses: [
      "Enforce MFA on every remote-access path, including legacy and vendor portals; decommission what you don't need.",
      "Treat credential-exposure alerts as incidents: force a reset and revoke sessions within hours.",
      "Store service credentials in a vault or use managed service accounts; scan shares for plaintext secrets.",
      "Remove service accounts from Domain Admins and deny them interactive logon.",
      "Alert on new accounts added to privileged groups, and on large first-seen egress destinations.",
    ],
    commonMistakes: [
      "Missing the UTC conversion and searching for 20:41 instead of 02:41.",
      "Confusing 198.51.100.77 with Jordan's real 198.51.100.73.",
      "Concluding 'MFA wasn't enrolled' — jkaplan was enrolled; the legacy portal didn't enforce it.",
      "Leaving VDI-LEGACY-03 or DC-01 off the exposure list.",
      "Choosing to reimage first, destroying evidence needed for scoping and notification decisions.",
    ],
    resources: [
      { title: "MITRE ATT&CK: Valid Accounts", publisher: "MITRE", url: "https://attack.mitre.org/techniques/T1078/" },
      { title: "MITRE ATT&CK: Unsecured Credentials in Files", publisher: "MITRE", url: "https://attack.mitre.org/techniques/T1552/001/" },
      { title: "More than a Password: Multifactor Authentication", publisher: "CISA", url: "https://www.cisa.gov/MFA" },
    ],
  },
  references: [],
};
