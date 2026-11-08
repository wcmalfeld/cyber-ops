/**
 * Colorado company reference records (PRD §5). Seeded into the `company_profiles`
 * table; edit here (or in the database) and re-seed — no application code changes.
 *
 * Educational reference only. No logos, no ranking, no implied partnership.
 * `review.status` tracks whether each profile has been checked against the
 * company's own public materials.
 */
import type { PathId, SkillId } from "@/engine/schema";

export interface CompanyProfile {
  id: string;
  name: string;
  location: string;
  website: string;
  description: string;
  specialties: string[];
  concepts: string[];
  relatedPaths: PathId[];
  relatedSkills: SkillId[];
  problemsAddressed: string;
  platformInspiration: string;
  review: { status: "verified" | "pending"; checkedOn: string | null; notes: string };
}

const PENDING = {
  status: "pending" as const,
  checkedOn: null,
  notes: "Location and specialties from the product brief (PRD v1.0). Confirm against the company's website before public launch.",
};

export const COMPANIES: CompanyProfile[] = [
  {
    id: "circadence",
    name: "Circadence",
    location: "Boulder, Colorado",
    website: "https://circadence.com/",
    description: "Builds cyber ranges and simulation-based training for security teams.",
    specialties: ["Cybersecurity training", "Cyber ranges", "Security simulation", "Red and Blue Team training", "Interactive learning environments"],
    concepts: ["Cyber range engineering", "Scenario design", "Attack emulation", "Team-based exercises"],
    relatedPaths: ["soc", "red_team"],
    relatedSkills: ["incident_response", "threat_hunting", "linux", "networking"],
    problemsAddressed:
      "Security teams need realistic practice before a real incident. Cyber ranges provide safe, repeatable environments where defenders and attackers can rehearse.",
    platformInspiration: "The idea of immersive, hands-on range training — not a reproduction of any proprietary platform.",
    review: PENDING,
  },
  {
    id: "automox",
    name: "Automox",
    location: "Boulder, Colorado presence",
    website: "https://www.automox.com/",
    description: "Provides cloud-native endpoint management and IT automation.",
    specialties: ["Endpoint management", "IT automation", "Vulnerability remediation", "Patch management", "Device security"],
    concepts: ["Patch prioritization", "Device inventory", "Configuration baselines", "Remediation at scale"],
    relatedPaths: ["endpoint"],
    relatedSkills: ["endpoint_security", "vulnerability_management", "windows", "linux"],
    problemsAddressed:
      "Organizations run hundreds or thousands of devices. Knowing which are outdated, which vulnerabilities matter most, and fixing them quickly is a constant operational challenge.",
    platformInspiration: "Endpoint missions where the player secures a large fleet: find outdated software, prioritize, remediate.",
    review: PENDING,
  },
  {
    id: "radicl",
    name: "RADICL",
    location: "Boulder, Colorado",
    website: "https://radicl.com/",
    description: "Offers managed security operations and monitoring, with an emphasis on AI-assisted security operations.",
    specialties: ["Managed cybersecurity", "Security operations", "Security monitoring", "Incident response", "AI-powered security operations"],
    concepts: ["Alert triage", "Managed detection and response", "Indicators of compromise", "Escalation"],
    relatedPaths: ["soc"],
    relatedSkills: ["incident_response", "threat_hunting", "networking"],
    problemsAddressed:
      "Many organizations can't staff a 24/7 SOC. Managed security operations watch alerts around the clock and decide which are real threats.",
    platformInspiration: "A simulated SOC queue where players separate genuine threats from noise.",
    review: PENDING,
  },
  {
    id: "enzoic",
    name: "Enzoic",
    location: "Boulder, Colorado",
    website: "https://www.enzoic.com/",
    description: "Focuses on detecting compromised credentials and preventing account takeover.",
    specialties: ["Compromised credential detection", "Password security", "Identity protection", "Account takeover prevention", "Exposed credential intelligence"],
    concepts: ["Credential screening", "Infostealer logs", "Password policy", "Account takeover"],
    relatedPaths: ["cloud_identity", "soc"],
    relatedSkills: ["identity_management", "threat_hunting"],
    problemsAddressed:
      "Stolen and reused passwords are a leading cause of breaches. Detecting exposed credentials early lets organizations reset them before attackers use them.",
    platformInspiration: "Credential-security challenges: stolen passwords, infostealer exposure, and blocking unauthorized access.",
    review: PENDING,
  },
  {
    id: "rule4",
    name: "Rule4",
    location: "Boulder, Colorado",
    website: "https://www.rule4.com/",
    description: "Security consulting firm offering penetration testing, cloud security and incident response services.",
    specialties: ["Application penetration testing", "Cloud security", "Security consulting", "Vulnerability assessments", "Incident response", "Emerging technology security"],
    concepts: ["Security findings", "Risk rating", "Remediation guidance", "Assessment reports"],
    relatedPaths: ["appsec", "red_team", "cloud_identity"],
    relatedSkills: ["application_security", "web_security", "cloud_security", "vulnerability_management"],
    problemsAddressed:
      "Organizations need independent experts to find weaknesses before attackers do, and to explain them clearly enough to fix.",
    platformInspiration: "Application assessments where players inspect vulnerable apps and write professional findings.",
    review: PENDING,
  },
  {
    id: "managedmethods",
    name: "ManagedMethods",
    location: "Boulder, Colorado",
    website: "https://managedmethods.com/",
    description: "Provides cloud application security for Google Workspace and Microsoft 365, with a focus on education.",
    specialties: ["SaaS application security", "Google Workspace security", "Microsoft 365 security", "Education-sector data protection", "Cloud application monitoring"],
    concepts: ["File-sharing risk", "SaaS account monitoring", "Phishing in cloud email", "Student data protection"],
    relatedPaths: ["cloud_identity"],
    relatedSkills: ["cloud_security", "identity_management"],
    problemsAddressed:
      "Schools and businesses store sensitive data in cloud apps. Spotting compromised accounts, risky sharing and phishing inside those apps protects students and staff.",
    platformInspiration: "Cloud investigations: suspicious file sharing, compromised school accounts, sensitive student data.",
    review: PENDING,
  },
  {
    id: "jumpcloud",
    name: "JumpCloud",
    location: "Louisville, Colorado",
    website: "https://jumpcloud.com/",
    description: "Offers a cloud directory platform for identity, access and device management.",
    specialties: ["Cloud directory services", "Identity management", "Access control", "Device management", "Zero Trust security"],
    concepts: ["Directory services", "Onboarding/offboarding", "Privileged access", "Conditional access"],
    relatedPaths: ["cloud_identity", "endpoint"],
    relatedSkills: ["identity_management", "endpoint_security", "cloud_security"],
    problemsAddressed:
      "Every employee needs the right access to the right systems — no more, no less — and that access must be removed when they leave or when an account is compromised.",
    platformInspiration: "IAM challenges: onboarding, permissions, privileged users, compromised admin accounts.",
    review: PENDING,
  },
];

export const INDUSTRY_DISCLAIMER =
  "Company profiles are provided for educational and career-exploration purposes. These missions are independently developed simulations inspired by publicly described industry specialties. CYBER OPS is not affiliated with or endorsed by the featured companies.";
