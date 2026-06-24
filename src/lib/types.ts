// App-level TypeScript types that mirror the database schema (supabase/schema.sql).

export type SplitType = "equal" | "custom" | "percentage";
export type SplitStatus = "unpaid" | "paid" | "confirmed";
// Category is a per-house code (the defaults below, or a custom one the house
// added). Stored as free text; resolved for display via house_categories.
export type ExpenseCategory = string;

export interface HouseCategory {
  id: string;
  house_id: string;
  code: string;
  name: string;
  emoji: string;
  color: string;
  sort: number;
  archived: boolean;
}
export type BillFrequency = "weekly" | "monthly" | "quarterly" | "yearly";
export type ChoreRepeat = "once" | "weekly" | "fortnightly" | "monthly";
export type ChoreStatus = "todo" | "done" | "missed";
export type MemberRole = "admin" | "member";

export interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  avatar_color: string;
  avatar_url: string | null;
  created_at: string;
  welcomed_at: string | null;
}

/**
 * Optional person-to-person payment handles + who may see them. RLS enforces
 * the consent switch: housemates can only read a row while share_with_house
 * is true; the owner can always read their own.
 */
export interface PaymentDetails {
  user_id: string;
  monzo: string | null;
  paypal: string | null;
  revolut: string | null;
  bank: string | null;
  share_with_house: boolean;
  updated_at: string;
}

export interface House {
  id: string;
  name: string;
  currency: string;
  rent_due_day: number | null;
  address_nickname: string | null;
  invite_code: string;
  created_by: string | null;
  created_at: string;
}

export interface HouseMember {
  id: string;
  house_id: string;
  user_id: string;
  role: MemberRole;
  move_in_date: string | null;
  move_out_date: string | null;
  joined_at: string;
}

/** A house member joined with their profile — handy for lists. */
export interface MemberWithProfile extends HouseMember {
  profile: Profile | null;
}

export interface Expense {
  id: string;
  house_id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  paid_by: string | null;
  split_type: SplitType;
  date: string;
  receipt_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  bill_id: string | null;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  amount_owed: number;
  status: SplitStatus;
  paid_at: string | null;
  confirmed_at: string | null;
}

export interface RecurringBill {
  id: string;
  house_id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  frequency: BillFrequency;
  due_day: number | null;
  next_due_date: string | null;
  paid_by: string | null;
  split_type: SplitType;
  reminder_enabled: boolean;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Chore {
  id: string;
  house_id: string;
  title: string;
  assigned_to: string | null;
  due_date: string | null;
  repeat: ChoreRepeat;
  status: ChoreStatus;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  house_id: string;
  user_id: string | null;
  type: string;
  message: string;
  created_at: string;
}

export interface Notice {
  id: string;
  house_id: string;
  title: string;
  message: string | null;
  posted_by: string | null;
  pinned: boolean;
  created_at: string;
}

/** A house chat message. */
export interface Message {
  id: string;
  house_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

/** Private, account-level settings — only the owner can read these. */
export interface AccountSettings {
  user_id: string;
  phone: string | null;
  phone_verified: boolean;
  notify_email: boolean;
  notify_sms: boolean;
  updated_at: string;
  email_verified_at: string | null;
  email_verify_token: string | null;
  email_verify_expires: string | null;
  monthly_budget: number | null;
  notify_push_message: boolean;
  notify_push_expense: boolean;
  notify_push_bill: boolean;
  notify_push_paid: boolean;
  notify_push_chore: boolean;
  notify_push_member: boolean;
  notify_email_bills: boolean;
  notify_email_nudges: boolean;
  notify_email_product: boolean;
  notify_email_tips: boolean;
  notify_email_surveys: boolean;
  notify_email_offers: boolean;
}

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; emoji: string }[] = [
  { value: "rent", label: "Rent", emoji: "🏠" },
  { value: "bills", label: "Bills", emoji: "💡" },
  { value: "groceries", label: "Groceries", emoji: "🛒" },
  { value: "cleaning", label: "Cleaning", emoji: "🧽" },
  { value: "furniture", label: "Furniture", emoji: "🛋️" },
  { value: "other", label: "Other", emoji: "📦" },
];

export const BILL_FREQUENCIES: { value: BillFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

export const CHORE_REPEATS: { value: ChoreRepeat; label: string }[] = [
  { value: "once", label: "One-off" },
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
];
