// Hand-maintained row types matching supabase/migrations/0001_schema.sql.
// Keep in sync when the schema changes.

export type UserRole = 'client' | 'admin';
export type PlanIdDb = 'audit' | 'essentials' | 'professional' | 'partner';
export type SubscriptionStatus =
  | 'trialing' | 'active' | 'past_due' | 'canceled'
  | 'incomplete' | 'incomplete_expired' | 'unpaid' | 'paused';
export type AuditKind = 'one_off' | 're_audit';
export type AuditStatus = 'intake' | 'evidence' | 'in_review' | 'report_draft' | 'delivered' | 'closed';
export type ItemStatus = 'unset' | 'present' | 'missing' | 'out_of_date' | 'na';
export type RagStatus = 'unset' | 'green' | 'amber' | 'red';
export type RequirementLevel = 'legal' | 'cqc' | 'best' | 'optional';
export type SocialProfileCategory = 'social' | 'messaging' | 'reviews' | 'directory' | 'other';
export type SafAnswer = 'unset' | 'yes' | 'partial' | 'no' | 'na';
export type SafDomain = 'safe' | 'effective' | 'caring' | 'responsive' | 'well_led';
export type ScanStatus = 'pending' | 'clean' | 'infected' | 'error';
export type ReviewStatus = 'pending' | 'reviewed' | 'flagged';
export type RequestStatus = 'open' | 'in_review' | 'delivered' | 'closed';
export type PriorityLevel = 'low' | 'medium' | 'high';
export type DocStatus = 'issued' | 'superseded' | 'withdrawn';
export type EvidenceLifecycleState = 'current' | 'superseded';
export type FindingPriority = 'fix_first' | 'days_7' | 'days_14' | 'days_30';
export type FindingStatus = 'open' | 'resolved';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  org_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organisation {
  id: string;
  name: string;
  service_type: string;
  cqc_provider_id: string | null;
  cqc_location_id: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface SocialProfile {
  id: string;
  org_id: string;
  category: SocialProfileCategory;
  platform: string;
  label: string | null;
  handle: string | null;
  url: string | null;
  notes: string | null;
  sort: number;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  org_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  plan: PlanIdDb;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface Purchase {
  id: string;
  org_id: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  product: PlanIdDb;
  amount_pence: number;
  status: 'paid' | 'refunded';
  created_at: string;
}

export interface LibraryArea {
  code: string;
  name: string;
  regulation_title: string | null;
  regulation_summary: string | null;
  sort: number;
}

export interface LibraryAsset {
  id: string;
  area_code: string;
  ref: string;
  title: string;
  doc_type: string;
  requirement: RequirementLevel;
  commercial_value: string | null;
  regulatory_basis: string | null;
  storage_path: string | null;
  current_version: number;
  updated_at: string;
}

export interface ClientDocument {
  id: string;
  org_id: string;
  asset_id: string | null;
  audit_id: string | null;
  title: string;
  storage_path: string;
  file_name: string | null;
  version: string;
  note: string | null;
  status: DocStatus;
  issued_by: string | null;
  issued_at: string;
  review_due_at: string | null;
}

export interface EngineRun {
  id: string;
  kind: string;
  org_id: string | null;
  audit_id: string | null;
  stats: Record<string, unknown>;
  duration_ms: number | null;
  created_at: string;
}

export interface EvidenceFile {
  id: string;
  org_id: string;
  audit_id: string | null;
  area_code: string | null;
  storage_path: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  scan_status: ScanStatus;
  review_status: ReviewStatus;
  extract_status: 'pending' | 'done' | 'unsupported' | 'failed';
  extract_method: string | null;
  word_count: number | null;
  extracted_at: string | null;
  verification: Record<string, unknown> | null;
  verified_at: string | null;
  lifecycle_state: EvidenceLifecycleState;
  replaces_evidence_id: string | null;
  superseded_by_id: string | null;
  reviewer_note: string | null;
  created_at: string;
}

export interface Audit {
  id: string;
  org_id: string;
  kind: AuditKind;
  status: AuditStatus;
  intake: Record<string, unknown>;
  score: number | null;
  summary: string | null;
  purchase_id: string | null;
  parent_audit_id: string | null;
  auto_created: boolean;
  started_at: string;
  due_at: string | null;
  delivered_at: string | null;
  signed_off_by: string | null;
  signed_off_at: string | null;
  sign_off_name: string | null;
  sign_off_statement: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditItem {
  id: string;
  audit_id: string;
  area_code: string;
  ref: string;
  title: string;
  requirement: RequirementLevel;
  status: ItemStatus;
  note: string | null;
  evidence_id: string | null;
  suggested_status: ItemStatus;
  suggested_evidence_id: string | null;
  suggestion_confidence: number | null;
  suggestion_reason: string | null;
  updated_at: string;
}

export interface AuditArea {
  id: string;
  audit_id: string;
  area_code: string;
  rag: RagStatus;
  evidence_sighted: string | null;
  findings: string | null;
  action: string | null;
  owner: string | null;
  updated_at: string;
}

export interface SafQuestion {
  id: number;
  domain: SafDomain;
  statement_no: number;
  statement: string;
  question: string;
  evidence_hint: string | null;
  priority: boolean;
}

export interface SafResponse {
  id: string;
  audit_id: string;
  question_id: number;
  answer: SafAnswer;
  note: string | null;
  suggested_answer: SafAnswer;
  suggestion_reason: string | null;
  updated_at: string;
}

export interface AuditFinding {
  id: string;
  audit_id: string;
  org_id: string;
  area_code: string | null;
  severity: RagStatus;
  title: string;
  detail: string | null;
  recommendation: string | null;
  priority: FindingPriority;
  status: FindingStatus;
  sort: number;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  audit_id: string;
  org_id: string;
  storage_path: string;
  score: number;
  version: number;
  published: boolean;
  issued_at: string | null;
  created_at: string;
}

export type SampleVerdict =
  | 'unset'
  | 'compliant'
  | 'partial'
  | 'not_compliant'
  | 'not_applicable';

/** Auditor file-sampling review of one client record examined in depth. */
export interface FileSample {
  id: string;
  audit_id: string;
  org_id: string;
  evidence_id: string;
  area_code: string | null;
  sample_type: string;
  verdict: SampleVerdict;
  findings: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplianceRequest {
  id: string;
  org_id: string;
  created_by: string | null;
  type: string;
  priority: PriorityLevel;
  description: string;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
}

export interface RequestMessage {
  id: string;
  request_id: string;
  author_id: string | null;
  body: string;
  is_admin: boolean;
  created_at: string;
}

export interface Alert {
  id: string;
  title: string;
  body: string;
  category: string;
  external_url: string | null;
  source_kind: string;
  legislative: boolean;
  published: boolean;
  published_at: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  org_id: string | null;
  title: string;
  description: string | null;
  event_type: string;
  due_date: string;
  source: string;
  alert_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  detail: string | null;
  org_id: string | null;
  audit_id: string | null;
  kind: string;
  priority: PriorityLevel;
  due_date: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  handled: boolean;
  created_at: string;
}

// Kept for compatibility with the generic supabase client generic parameter.
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
