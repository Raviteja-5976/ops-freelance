export type UserRole = "admin" | "client";
export type ClientStatus = "active" | "archived";
export type ProjectStatus =
  | "planning"
  | "design"
  | "development"
  | "testing"
  | "review"
  | "launch"
  | "completed"
  | "on_hold"
  | "archived";
export type MilestoneStatus = "upcoming" | "in_progress" | "completed" | "skipped";
export type PaymentStatus =
  | "scheduled"
  | "due"
  | "paid"
  | "failed"
  | "refunded"
  | "cancelled";
export type PaymentMethod =
  | "bank_transfer"
  | "upi"
  | "card"
  | "netbanking"
  | "cash"
  | "other";
export type InvoiceStatus = "draft" | "issued" | "partly_paid" | "paid" | "void";
export type CallStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "reschedule_proposed"
  | "completed"
  | "cancelled";
export type Visibility = "client" | "admin";
export type DocCategory =
  | "contract"
  | "proposal"
  | "design"
  | "report"
  | "invoice"
  | "other";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone?: string | null;
  timezone: string;
  avatar_url?: string | null;
  last_seen_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  legal_name?: string | null;
  gstin?: string | null;
  pan?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  state_code?: string | null;
  postal_code?: string | null;
  country?: string | null;
  status: ClientStatus;
  internal_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientMember {
  client_id: string;
  profile_id: string;
  is_primary: boolean;
  created_at: string;
  profile?: Profile;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  summary?: string | null;
  description?: string | null;
  status: ProjectStatus;
  progress: number;
  progress_mode: "auto" | "manual";
  currency: string;
  total_value: number; // in paise
  start_date?: string | null;
  expected_delivery?: string | null;
  delivered_at?: string | null;
  visible_to_client: boolean;
  created_at: string;
  updated_at: string;
  client?: Client;
}

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description?: string | null;
  status: MilestoneStatus;
  start_date?: string | null;
  end_date?: string | null;
  completed_at?: string | null;
  position: number;
  visible_to_client: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectUpdate {
  id: string;
  project_id: string;
  title?: string | null;
  body: string;
  published_at?: string | null;
  notified_at?: string | null;
  author_id?: string | null;
  created_at: string;
  updated_at: string;
  author?: Profile;
}

export interface ProjectFeature {
  id: string;
  project_id: string;
  label: string;
  note?: string | null;
  included: boolean;
  position: number;
}

export interface ProjectTechnology {
  id: string;
  project_id: string;
  area: string;
  name: string;
  position: number;
}

export interface Payment {
  id: string;
  project_id: string;
  client_id: string;
  invoice_id?: string | null;
  label: string;
  amount: number; // paise
  currency: string;
  status: PaymentStatus;
  due_date?: string | null;
  paid_at?: string | null;
  method?: PaymentMethod | null;
  reference?: string | null;
  gateway?: string | null;
  gateway_order_id?: string | null;
  gateway_payment_id?: string | null;
  payment_link_url?: string | null;
  notes?: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  invoice?: Invoice;
  project?: Project;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  hsn_sac?: string | null;
  quantity: number;
  unit_price: number; // paise
  discount: number; // paise
  tax_rate_bps: number; // 1800 = 18%
  taxable_value: number; // paise
  cgst: number; // paise
  sgst: number; // paise
  igst: number; // paise
  line_total: number; // paise
  position: number;
}

export interface Invoice {
  id: string;
  client_id: string;
  project_id?: string | null;
  number?: string | null;
  series: string;
  fy?: string | null;
  status: InvoiceStatus;
  issue_date?: string | null;
  due_date?: string | null;
  currency: string;
  bill_to_snapshot?: Record<string, any> | null;
  seller_snapshot?: Record<string, any> | null;
  place_of_supply?: string | null;
  is_interstate: boolean;
  subtotal: number; // paise
  discount_total: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  total: number; // paise
  amount_paid: number;
  notes?: string | null;
  terms?: string | null;
  pdf_path?: string | null;
  issued_at?: string | null;
  voided_at?: string | null;
  void_reason?: string | null;
  created_at: string;
  updated_at: string;
  items?: InvoiceItem[];
  client?: Client;
  project?: Project;
}

export interface Document {
  id: string;
  client_id: string;
  project_id?: string | null;
  title: string;
  description?: string | null;
  category: DocCategory;
  storage_path: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  visibility: Visibility;
  uploaded_by?: string | null;
  created_at: string;
}

export interface AvailabilityRule {
  id: string;
  weekday: number; // 0=Sun, 1=Mon, ..., 6=Sat
  start_time: string; // "10:00"
  end_time: string; // "13:00"
  is_active: boolean;
}

export interface AvailabilityException {
  id: string;
  date: string;
  is_blocked: boolean;
  start_time?: string | null;
  end_time?: string | null;
  reason?: string | null;
}

export interface CallRequest {
  id: string;
  client_id: string;
  project_id?: string | null;
  requested_by: string;
  requested_start: string;
  duration_minutes: number;
  reason: string;
  status: CallStatus;
  confirmed_start?: string | null;
  confirmed_end?: string | null;
  proposed_start?: string | null;
  meeting_url?: string | null;
  admin_note?: string | null;
  responded_at?: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  project?: Project;
  requested_by_profile?: Profile;
}

export interface Settings {
  id: number;
  business_name: string;
  legal_name?: string | null;
  gstin?: string | null;
  pan?: string | null;
  address?: Record<string, any> | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  logo_path?: string | null;
  default_currency: string;
  default_tax_rate_bps: number;
  invoice_series: string;
  invoice_terms?: string | null;
  invoice_notes?: string | null;
  timezone: string;
  call_duration_minutes: number;
  call_buffer_minutes: number;
  call_min_notice_hours: number;
  call_max_days_ahead: number;
  updated_at: string;
}

export interface ActivityLog {
  id: number;
  actor_id?: string | null;
  actor_role?: UserRole | null;
  entity_type: string;
  entity_id?: string | null;
  client_id?: string | null;
  action: string;
  diff?: Record<string, any> | null;
  created_at: string;
}

export interface ProjectFinancials {
  project_id: string;
  client_id: string;
  total_value: number;
  amount_paid: number;
  balance: number;
  next_due_date?: string | null;
}
