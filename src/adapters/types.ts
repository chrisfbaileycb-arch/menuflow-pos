export type PosProvider =
  | "heartland"
  | "toast"
  | "square"
  | "clover";

export type PosWorkflowAction =
  | "staff_sync_import"
  | "staff_sync_export"
  | "rewards_sync_import"
  | "rewards_sync_export"
  | "menu_audit_scan"
  | "timecard_pull";

export type StaffRole = "server" | "bartender" | "cook" | "shift_lead" | "manager";

export type RewardTier = "bronze" | "silver" | "gold" | "platinum";

export interface StaffRecord {
  employeeId: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
  email: string;
  phone: string;
  hourlyRate: number;
  pinCode?: string;
  active: boolean;
}

export interface RewardsMemberRecord {
  memberId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  pointsBalance: number;
  tier: RewardTier;
  enrollmentDate: string;
  totalLifetimeSpend: number;
}

export interface CsvImportFailure {
  row: number;
  raw: Record<string, string>;
  error: string;
}

export interface CsvImportResult<T> {
  success: boolean;
  inserted: number;
  updated: number;
  failedRecords: CsvImportFailure[];
  records: T[];
}


export type CredentialType = "bearer_token" | "api_key_secret" | "oauth2" | "session_cookie";

export interface PosSkillParameter {
  name: string;
  type: "string" | "number" | "boolean" | "file_buffer";
  description: string;
  required: boolean;
}

export interface PosWorkflowSkill {
  action: PosWorkflowAction;
  name: string;
  description: string;
  parameters: PosSkillParameter[];
  requiredPermissions: string[];
}

export type TargetEnvironment = "cloud_api" | "local_agent" | "hybrid_browser_bridge";

export interface PosSkillSetDefinition {
  provider: PosProvider;
  version: string;
  targetEnvironment: TargetEnvironment;
  authRequirements: {
    type: CredentialType;
    credentialFields: string[];
  };
  supportedWorkflows: PosWorkflowAction[];
  skills: PosWorkflowSkill[];
}
