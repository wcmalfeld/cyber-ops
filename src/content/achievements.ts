export const ACHIEVEMENTS = [
  { id: "first-flag", name: "First Flag", description: "Submit your first valid CYBEROPS flag." },
  { id: "first-mission", name: "Mission Complete", description: "Complete your first mission." },
  { id: "independent-operator", name: "Independent Operator", description: "Complete a mission without revealing any hints." },
  { id: "dossier-investigator", name: "Dossier Investigator", description: "Complete a Breach Dossier investigation." },
] as const;

export type AchievementId = (typeof ACHIEVEMENTS)[number]["id"];
