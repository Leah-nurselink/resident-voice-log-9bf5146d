export const ROLES = ["admin", "manager", "nurse", "senior_carer", "carer", "md", "family"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Registered Manager",
  nurse: "Nurse",
  senior_carer: "Senior Carer",
  carer: "Carer",
  md: "Medical Doctor",
  family: "Family",
};

export const PERMISSIONS = [
  { key: "edit_care_plans", label: "Edit care plans" },
  { key: "edit_risk_assessments", label: "Edit risk assessments" },
  { key: "edit_mca", label: "Edit MCA assessments" },
  { key: "edit_consent", label: "Edit consent records" },
  { key: "manage_wounds", label: "Manage wound charts" },
  { key: "manage_medications", label: "Add / edit medications" },
  { key: "administer_medication", label: "Record medication given" },
  { key: "write_notes", label: "Write care notes" },
  { key: "approve_notes", label: "Approve care notes" },
  { key: "complete_audits", label: "Complete audits" },
  { key: "manage_residents", label: "Add / edit residents" },
  { key: "manage_users", label: "Manage staff accounts" },
  { key: "view_analytics", label: "View analytics" },
  { key: "raise_safeguarding", label: "Raise safeguarding alerts" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

// Default per-role capabilities used to seed permissions when an admin assigns a role.
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, PermissionKey[]> = {
  admin: PERMISSIONS.map((p) => p.key),
  manager: [
    "edit_care_plans","edit_risk_assessments","edit_mca","edit_consent","manage_wounds",
    "manage_medications","administer_medication",
    "write_notes","approve_notes","complete_audits","manage_residents","view_analytics","raise_safeguarding",
  ],
  nurse: [
    "edit_care_plans","edit_risk_assessments","edit_mca","manage_wounds",
    "manage_medications","administer_medication",
    "write_notes","approve_notes","complete_audits","raise_safeguarding",
  ],
  senior_carer: ["write_notes","approve_notes","complete_audits","manage_wounds","administer_medication","raise_safeguarding"],
  carer: ["write_notes"],
  md: ["edit_care_plans","edit_risk_assessments","write_notes","approve_notes","manage_medications"],
  family: [],
};
