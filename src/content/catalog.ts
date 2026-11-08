/**
 * Static reference catalog: skills, specializations and careers.
 * Missions live in ./missions and are registered in ./missions/index.ts.
 */
import type { PathId, SkillId } from "@/engine/schema";

export const SKILL_INFO: Record<SkillId, { name: string; description: string }> = {
  networking: { name: "Networking", description: "IP addressing, ports, protocols, and reading network activity." },
  linux: { name: "Linux", description: "Navigating, inspecting and securing Linux systems from the command line." },
  windows: { name: "Windows", description: "Windows and Active Directory administration and security events." },
  programming: { name: "Programming", description: "Reading and writing code to automate and analyze." },
  cryptography: { name: "Cryptography", description: "Encoding, hashing and encryption fundamentals." },
  application_security: { name: "Application Security", description: "Finding and fixing weaknesses in software and secrets handling." },
  web_security: { name: "Web Security", description: "HTTP, web vulnerabilities and session management." },
  cloud_security: { name: "Cloud Security", description: "Cloud identity, storage and configuration risks." },
  identity_management: { name: "Identity Management", description: "Authentication, MFA, privileges and account lifecycle." },
  digital_forensics: { name: "Digital Forensics", description: "Recovering and interpreting artifacts to establish what happened." },
  incident_response: { name: "Incident Response", description: "Scoping, containing and recovering from intrusions." },
  threat_hunting: { name: "Threat Hunting", description: "Proactively finding attacker activity in data." },
  vulnerability_management: { name: "Vulnerability Management", description: "Finding, prioritizing and remediating weaknesses at scale." },
  endpoint_security: { name: "Endpoint Security", description: "Securing and monitoring workstations, servers and devices." },
};

export const PATH_INFO: Record<PathId, { name: string; focus: string }> = {
  soc: { name: "SOC Analyst / Blue Team", focus: "Identifying, investigating and responding to threats." },
  red_team: { name: "Penetration Testing / Red Team", focus: "Finding and exploiting vulnerabilities in authorized, intentionally vulnerable labs." },
  dfir: { name: "Digital Forensics / Incident Response", focus: "Reconstructing what happened during an incident." },
  cloud_identity: { name: "Cloud Security / Identity", focus: "Cloud infrastructure, identities and access permissions." },
  appsec: { name: "Application Security", focus: "Vulnerabilities in code, APIs and business applications." },
  endpoint: { name: "Endpoint Security / IT Security", focus: "Securing and maintaining an organization's devices." },
};

/** Career specializations (PRD §12.1) mapped to the skills that evidence readiness. */
export const CAREERS: { id: string; name: string; skills: SkillId[]; companyIds: string[] }[] = [
  { id: "soc-analyst", name: "SOC Analyst", skills: ["incident_response", "threat_hunting", "networking", "identity_management"], companyIds: ["radicl"] },
  { id: "security-analyst", name: "Security Analyst", skills: ["incident_response", "vulnerability_management", "identity_management"], companyIds: ["radicl", "rule4"] },
  { id: "pentester", name: "Penetration Tester", skills: ["web_security", "linux", "networking", "application_security"], companyIds: ["rule4", "circadence"] },
  { id: "appsec-engineer", name: "Application Security Engineer", skills: ["application_security", "web_security", "programming"], companyIds: ["rule4"] },
  { id: "cloud-security-engineer", name: "Cloud Security Engineer", skills: ["cloud_security", "identity_management", "networking"], companyIds: ["managedmethods", "jumpcloud"] },
  { id: "forensics-analyst", name: "Digital Forensics Analyst", skills: ["digital_forensics", "linux", "windows"], companyIds: ["circadence"] },
  { id: "ir-analyst", name: "Incident Response Analyst", skills: ["incident_response", "digital_forensics", "threat_hunting"], companyIds: ["radicl", "rule4"] },
  { id: "vuln-analyst", name: "Vulnerability Management Analyst", skills: ["vulnerability_management", "endpoint_security"], companyIds: ["automox"] },
  { id: "endpoint-engineer", name: "Endpoint Security Engineer", skills: ["endpoint_security", "windows", "linux"], companyIds: ["automox", "jumpcloud"] },
  { id: "iam-specialist", name: "Identity and Access Management Specialist", skills: ["identity_management", "cloud_security"], companyIds: ["jumpcloud", "enzoic"] },
];

/** Training levels (PRD §3.2): what each level expects. Requirements guide; they never block exploration. */
export const LEVEL_REQUIREMENTS: { level: number; expects: string; completion: string }[] = [
  { level: 0, expects: "No prior security knowledge. Comfort using a computer.", completion: "Complete one Orientation mission." },
  { level: 1, expects: "Basic command-line navigation; reading a log file.", completion: "Complete two Junior Analyst missions." },
  { level: 2, expects: "Correlating evidence across sources; MFA and privilege concepts.", completion: "Complete three Security Analyst missions, one independently." },
  { level: 3, expects: "Scripting, web protocols, cloud identity fundamentals.", completion: "Complete three Security Engineer missions." },
  { level: 4, expects: "Independent investigation with minimal guidance.", completion: "Complete two Advanced Operator missions independently." },
  { level: 5, expects: "Specialist depth in at least one path.", completion: "Reach Proficient mastery in a specialization's core skills." },
];
