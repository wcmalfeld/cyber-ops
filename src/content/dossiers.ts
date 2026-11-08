/**
 * Breach Dossiers — the HISTORICAL record, kept separate from playable simulations.
 *
 * Rules (PRD §6):
 *  - Every historical claim here must be supported by a listed public source.
 *  - Nothing from a mission's synthetic evidence belongs in this file.
 *  - `factCheck.status` records whether the text has been verified against its sources.
 *    "verified" = checked against the listed reference on `checkedOn`.
 *    "pending"  = taken from the product brief; must be checked before public launch.
 */
import type { Reference } from "@/engine/schema";

export interface Dossier {
  id: string;
  number: string;
  title: string;
  incident: string;
  incidentDate: string;
  coreSubjects: string[];
  historicalBriefing: string[];
  timeline: { date: string; event: string; sourceIndex: number }[];
  /** What the playable scenario invents. Shown in the debrief beside the confirmed facts. */
  fictionalizedElements: string[];
  lessons: string[];
  missionId: string | null;
  plannedScenario: string;
  companyIds: string[];
  references: Reference[];
  factCheck: { status: "verified" | "pending"; checkedOn: string | null; notes: string };
}

export const DOSSIERS: Dossier[] = [
  {
    id: "dossier-001",
    number: "001",
    title: "The Unlocked Door",
    incident: "Change Healthcare ransomware attack",
    incidentDate: "February 2024",
    coreSubjects: ["Compromised credentials", "Remote access security", "Missing MFA", "Privilege escalation", "Ransomware"],
    historicalBriefing: [
      "In written testimony to Congress in May 2024, UnitedHealth Group CEO Andrew Witty stated that on 12 February 2024 criminals used compromised credentials to remotely access a Change Healthcare Citrix portal — an application used to enable remote access to desktops.",
      "The testimony stated that the portal did not have multi-factor authentication. After gaining access, the attackers moved laterally within the systems and exfiltrated data. Ransomware was deployed nine days after initial access.",
      "The attack, attributed to the ALPHV/BlackCat ransomware group, caused widespread disruption to healthcare claims and payment processing. UnitedHealth Group said it paid a ransom.",
    ],
    timeline: [
      { date: "2024-02-12", event: "Attackers use compromised credentials to access a Citrix remote-access portal without MFA.", sourceIndex: 0 },
      { date: "2024-02-21", event: "Ransomware deployed, nine days after initial access.", sourceIndex: 1 },
      { date: "2024-05-01", event: "UnitedHealth Group CEO testifies before the House Energy & Commerce Committee.", sourceIndex: 0 },
    ],
    fictionalizedElements: [
      "Peakline Health Exchange, its employees, hostnames, IP addresses and accounts are invented.",
      "The infostealer origin of the stolen password is a plausible scenario for training; the public record does not say how Change Healthcare's credentials were obtained.",
      "The plaintext service-account script, the rogue helpdesk_tmp account and the 48 GiB exfiltration are invented to teach privilege escalation and scoping.",
      "The simulation ends before ransomware deployment; every timestamp in the evidence is synthetic.",
    ],
    lessons: [
      "Every remote-access path needs MFA — a single exception defeats it.",
      "Credential compromise, not exotic exploits, is a leading cause of major intrusions.",
      "Time between initial access and impact is an opportunity: detection inside that window changes the outcome.",
    ],
    missionId: "the-unlocked-door",
    plannedScenario: "Junior SOC analyst at a fictional healthcare clearinghouse investigates an unrecognized login.",
    companyIds: ["enzoic", "jumpcloud"],
    references: [
      {
        title: "Testimony of Andrew Witty, CEO, UnitedHealth Group — House Energy & Commerce Subcommittee on Oversight and Investigations (1 May 2024)",
        publisher: "U.S. Congress",
        url: "https://www.congress.gov/118/meeting/house/117242/witnesses/HHRG-118-IF02-Wstate-WittyS-20240501-U5.pdf",
      },
      {
        title: "Coverage of Andrew Witty's written testimony on the Change Healthcare attack",
        publisher: "Healthcare Dive",
        url: "https://www.healthcaredive.com/news/change-healthcare-compromised-credentials-no-mfa/714824/",
      },
    ],
    factCheck: {
      status: "verified",
      checkedOn: "2026-11-03",
      notes: "Initial access date, Citrix portal, missing MFA, lateral movement, exfiltration, nine-day interval, ALPHV attribution and ransom payment checked against Healthcare Dive's reporting of the written testimony.",
    },
  },
  {
    id: "dossier-002",
    number: "002",
    title: "The Ghost in the Database",
    incident: "UNC5537 campaign targeting Snowflake customer environments",
    incidentDate: "2024",
    coreSubjects: ["Infostealer malware", "Credential theft", "Cloud access", "MFA", "Data exfiltration"],
    historicalBriefing: [
      "In 2024, the threat actor tracked by Mandiant as UNC5537 accessed numerous Snowflake customer instances and stole data for extortion.",
      "Mandiant attributed the compromises to stolen customer credentials, largely harvested by infostealer malware, used against accounts without MFA. Mandiant did not find evidence that the activity resulted from a breach of Snowflake's own enterprise environment.",
    ],
    timeline: [],
    fictionalizedElements: ["Playable scenario not yet built."],
    lessons: [
      "Cloud platforms inherit the security of the credentials used to reach them.",
      "Credential exposure monitoring and MFA close the most common cloud account-takeover path.",
    ],
    missionId: null,
    plannedScenario: "Investigate suspicious access to a fictional company's cloud data warehouse.",
    companyIds: ["enzoic", "jumpcloud"],
    references: [
      {
        title: "UNC5537 Targets Snowflake Customer Instances for Data Theft and Extortion",
        publisher: "Google Cloud / Mandiant",
        url: "https://cloud.google.com/blog/topics/threat-intelligence/unc5537-snowflake-data-theft-extortion",
      },
    ],
    factCheck: { status: "pending", checkedOn: null, notes: "Text from product brief; verify against Mandiant report before launch." },
  },
  {
    id: "dossier-003",
    number: "003",
    title: "Package Poison",
    incident: "Shai-Hulud npm supply chain compromise",
    incidentDate: "September 2025",
    coreSubjects: ["Software supply chain", "Malicious npm dependencies", "Developer credential theft", "GitHub", "Cloud API keys"],
    historicalBriefing: [
      "In September 2025, a self-propagating worm dubbed Shai-Hulud compromised hundreds of packages in the npm ecosystem and harvested sensitive credentials from developer environments.",
      "CISA published an alert on the widespread supply chain compromise and recommended actions including dependency review and credential rotation.",
    ],
    timeline: [],
    fictionalizedElements: ["Playable scenario not yet built."],
    lessons: [
      "A routine dependency install can execute attacker code with a developer's credentials.",
      "Treat secrets on developer machines and CI runners as exposed after a malicious package install.",
    ],
    missionId: null,
    plannedScenario: "Application security engineer traces a malicious dependency through lockfiles, CI logs and exposed tokens.",
    companyIds: ["rule4", "automox"],
    references: [
      {
        title: "Widespread Supply Chain Compromise Impacting npm Ecosystem",
        publisher: "CISA",
        url: "https://www.cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem",
      },
      { title: "Shai-Hulud (S9008)", publisher: "MITRE ATT&CK", url: "https://attack.mitre.org/software/S9008/" },
    ],
    factCheck: { status: "pending", checkedOn: null, notes: "Text from product brief; verify against CISA alert before launch." },
  },
  {
    id: "dossier-004",
    number: "004",
    title: "The Server That Shouldn't Be There",
    incident: "ToolShell exploitation of on-premises Microsoft SharePoint",
    incidentDate: "July 2025",
    coreSubjects: ["Enterprise server exploitation", "Authentication vulnerabilities", "Remote code execution", "Web shells", "Forensics"],
    historicalBriefing: [
      "In July 2025, attackers exploited vulnerabilities in on-premises Microsoft SharePoint servers in a campaign known as ToolShell.",
      "CISA subsequently published a malware analysis report and detection guidance associated with the exploitation.",
    ],
    timeline: [],
    fictionalizedElements: ["Playable scenario not yet built."],
    lessons: ["Internet-facing on-premises servers need rapid patching and compromise assessment, not just patching."],
    missionId: null,
    plannedScenario: "Investigate web, application and filesystem artifacts on a fictional SharePoint server.",
    companyIds: ["rule4", "automox"],
    references: [
      {
        title: "CISA Releases Malware Analysis Report Associated with Microsoft SharePoint Vulnerabilities",
        publisher: "CISA",
        url: "https://www.cisa.gov/news-events/alerts/2025/08/06/cisa-releases-malware-analysis-report-associated-microsoft-sharepoint-vulnerabilities",
      },
    ],
    factCheck: { status: "pending", checkedOn: null, notes: "Text from product brief; verify against CISA report before launch." },
  },
  {
    id: "dossier-005",
    number: "005",
    title: "The Invisible Network Intruder",
    incident: "Salt Typhoon telecommunications espionage campaign",
    incidentDate: "Publicly disclosed beginning 2024",
    coreSubjects: ["Telecommunications security", "Network compromise", "Threat hunting", "Advanced persistent threats"],
    historicalBriefing: [
      "The FBI has reported that actors associated with the People's Republic of China, tracked as Salt Typhoon, compromised multiple U.S. telecommunications companies.",
      "According to the FBI, the activity included theft of call data logs, a limited number of private communications, and certain information related to law enforcement requests.",
    ],
    timeline: [],
    fictionalizedElements: ["Playable scenario not yet built."],
    lessons: ["Network infrastructure devices are high-value, low-visibility targets that need their own monitoring."],
    missionId: null,
    plannedScenario: "Hunt for a long-dwelling intruder across a fictional carrier's flow, router and firewall logs.",
    companyIds: ["radicl"],
    references: [
      {
        title: "FBI Seeking Tips About PRC Targeting of U.S. Telecommunications",
        publisher: "FBI",
        url: "https://www.fbi.gov/investigate/cyber/alerts/2025/fbi-seeking-tips-about-prc-targeting-of-us-telecommunications",
      },
    ],
    factCheck: { status: "pending", checkedOn: null, notes: "Text from product brief; verify against FBI alert before launch." },
  },
  {
    id: "dossier-006",
    number: "006",
    title: "Take Control of the Fleet",
    incident: "Stryker cyberattack and CISA endpoint-management guidance",
    incidentDate: "March 2026",
    coreSubjects: ["Endpoint management", "Administrative privileges", "Device control", "Security hardening"],
    historicalBriefing: [
      "On 11 March 2026, U.S.-based medical technology firm Stryker Corporation was hit by a cyberattack affecting its Microsoft environment.",
      "On 18 March 2026, CISA reported it was aware of malicious cyber activity targeting endpoint management systems at U.S. organizations and urged organizations to harden endpoint management configurations, using Microsoft Intune security best practices as a model.",
      "CISA's recommendations included least-privilege administrative roles, phishing-resistant MFA with privileged-access hygiene, and requiring a second administrator to approve high-impact changes such as device wipes.",
    ],
    timeline: [
      { date: "2026-03-11", event: "Cyberattack against Stryker affects its Microsoft environment.", sourceIndex: 0 },
      { date: "2026-03-18", event: "CISA urges endpoint management system hardening.", sourceIndex: 0 },
    ],
    fictionalizedElements: ["Playable scenario not yet built."],
    lessons: [
      "An endpoint management console is a remote control for every device — protect it like a domain controller.",
      "Multi-admin approval turns a single stolen admin account into a blocked change instead of a fleet-wide wipe.",
    ],
    missionId: null,
    plannedScenario: "Secure a fictional fleet of managed devices after suspicious administrative actions.",
    companyIds: ["automox", "jumpcloud"],
    references: [
      {
        title: "CISA Urges Endpoint Management System Hardening After Cyberattack Against US Organization",
        publisher: "CISA (GovDelivery bulletin)",
        url: "https://content.govdelivery.com/accounts/USDHSCISA/bulletins/40ef439",
      },
      { title: "CISA Cybersecurity Advisories", publisher: "CISA", url: "https://www.cisa.gov/news-events/cybersecurity-advisories" },
    ],
    factCheck: {
      status: "verified",
      checkedOn: "2026-11-03",
      notes: "Dates, victim identification, affected environment and recommendations checked against the CISA bulletin.",
    },
  },
];

export const dossierById = (id: string) => DOSSIERS.find((d) => d.id === id);
