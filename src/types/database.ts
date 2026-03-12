export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      households: {
        Row: {
          id: string
          name: string
          auto_sync_budget: boolean
          estimated_tax_rate: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          auto_sync_budget?: boolean
          estimated_tax_rate?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          auto_sync_budget?: boolean
          estimated_tax_rate?: number
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          household_id: string | null
          display_name: string | null
          created_at: string
        }
        Insert: {
          id: string
          household_id?: string | null
          display_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string | null
          display_name?: string | null
          created_at?: string
        }
        Relationships: []
      }
      accounts: {
        Row: {
          id: string
          household_id: string
          name: string
          type: AccountType
          balance: number
          updated_at: string
          notes: string | null
          sort_order: number
        }
        Insert: {
          id?: string
          household_id: string
          name: string
          type: AccountType
          balance?: number
          updated_at?: string
          notes?: string | null
          sort_order?: number
        }
        Update: {
          id?: string
          household_id?: string
          name?: string
          type?: AccountType
          balance?: number
          updated_at?: string
          notes?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      budget_items: {
        Row: {
          id: string
          household_id: string
          name: string
          category: ItemCategory
          monthly_amount: number
          frequency: ItemFrequency
          months_active: number[]
          is_income: boolean
          cc_paid: boolean
          active: boolean
          sort_order: number
        }
        Insert: {
          id?: string
          household_id: string
          name: string
          category: ItemCategory
          monthly_amount: number
          frequency?: ItemFrequency
          months_active?: number[]
          is_income?: boolean
          cc_paid?: boolean
          active?: boolean
          sort_order?: number
        }
        Update: {
          id?: string
          household_id?: string
          name?: string
          category?: ItemCategory
          monthly_amount?: number
          frequency?: ItemFrequency
          months_active?: number[]
          is_income?: boolean
          cc_paid?: boolean
          active?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      cashflow_entries: {
        Row: {
          id: string
          household_id: string
          budget_item_id: string | null
          year: number
          month: number
          projected_amount: number
          actual_amount: number | null
          is_paid: boolean
          paid_date: string | null
          notes: string | null
          name: string | null
          category: ItemCategory | null
        }
        Insert: {
          id?: string
          household_id: string
          budget_item_id?: string | null
          year: number
          month: number
          projected_amount: number
          actual_amount?: number | null
          is_paid?: boolean
          paid_date?: string | null
          notes?: string | null
          name?: string | null
          category?: ItemCategory | null
        }
        Update: {
          id?: string
          household_id?: string
          budget_item_id?: string | null
          year?: number
          month?: number
          projected_amount?: number
          actual_amount?: number | null
          is_paid?: boolean
          paid_date?: string | null
          notes?: string | null
          name?: string | null
          category?: ItemCategory | null
        }
        Relationships: []
      }
      income_sources: {
        Row: {
          id: string
          household_id: string
          name: string
          income_type: IncomeType
          monthly_target: number
          active: boolean
          sort_order: number
        }
        Insert: {
          id?: string
          household_id: string
          name: string
          income_type: IncomeType
          monthly_target?: number
          active?: boolean
          sort_order?: number
        }
        Update: {
          id?: string
          household_id?: string
          name?: string
          income_type?: IncomeType
          monthly_target?: number
          active?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      income_payments: {
        Row: {
          id: string
          household_id: string
          income_source_id: string
          description: string
          amount: number
          year: number
          month: number
          received: boolean
          received_date: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          household_id: string
          income_source_id: string
          description: string
          amount: number
          year: number
          month: number
          received?: boolean
          received_date?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          household_id?: string
          income_source_id?: string
          description?: string
          amount?: number
          year?: number
          month?: number
          received?: boolean
          received_date?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          household_id: string
          plaid_transaction_id: string | null
          account_id: string | null
          amount: number | null
          date: string | null
          description: string | null
          category: string | null
          matched_entry_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          plaid_transaction_id?: string | null
          account_id?: string | null
          amount?: number | null
          date?: string | null
          description?: string | null
          category?: string | null
          matched_entry_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          plaid_transaction_id?: string | null
          account_id?: string | null
          amount?: number | null
          date?: string | null
          description?: string | null
          category?: string | null
          matched_entry_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      account_type: AccountType
      item_frequency: ItemFrequency
      item_category: ItemCategory
      income_type: IncomeType
    }
  }
}

export type AccountType = 'cash' | 'credit' | 'retirement' | 'investment' | '529' | 'other'
export type ItemFrequency = 'monthly' | 'quarterly' | 'yearly' | 'one_time'
export type ItemCategory = 'housing' | 'utilities' | 'car' | 'food' | 'subscriptions' | 'misc' | 'business' | 'taxes' | 'savings' | 'income'
export type IncomeType = 'w2' | '1099' | 'untaxed'

// Convenience row types
export type Household = Database['public']['Tables']['households']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Account = Database['public']['Tables']['accounts']['Row']
export type BudgetItem = Database['public']['Tables']['budget_items']['Row']
export type CashflowEntry = Database['public']['Tables']['cashflow_entries']['Row']
export type IncomeSource = Database['public']['Tables']['income_sources']['Row']
export type IncomePayment = Database['public']['Tables']['income_payments']['Row']
