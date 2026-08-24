export interface Identity {
  website?: string | null
  location?: string | null
  founded_year?: number | null
  contact_email?: string | null
}

export interface Problem {
  description?: string | null
  pain_points: string[]
  current_solutions?: string | null
  validated: boolean
}

export interface Solution {
  product_name?: string | null
  description?: string | null
  value_proposition?: string | null
  tech_stack: string[]
  moat?: string | null
}

export interface Market {
  tam?: number | null
  sam?: number | null
  som?: number | null
  market_growth_rate?: number | null
  target_customer_persona?: string | null
}

export interface Traction {
  metrics: Record<string, number>
  milestones: string[]
  customer_logos: string[]
}

export interface TeamMember {
  name?: string | null
  role?: string | null
  linkedin?: string | null
  bio?: string | null
  superpower?: string | null
}

export interface Fundraising {
  round_stage?: string | null
  ask_amount?: number | null
  valuation_cap?: number | null
  use_of_funds?: string | null
}

export interface SIP {
  identity: Identity
  problem: Problem
  solution: Solution
  market: Market
  traction: Traction
  team: TeamMember[]
  fundraising: Fundraising
}

export interface StartupSummary {
  id: string
  name?: string | null
  one_liner?: string | null
  slug?: string | null
  created_at: string
}

export interface Startup extends StartupSummary {
  founder_id: string
  sip_data?: Partial<SIP> | null
  updated_at?: string | null
}

export type ReportStatus = "PENDING" | "COMPLETED" | "FAILED"

export interface ScoreBreakdown {
  market_opportunity: number
  product_solution: number
  traction_execution: number
  team: number
  moat_risks: number
}

export interface FundabilityAnalysis {
  total_score: number
  breakdown: ScoreBreakdown
  summary: string
  red_flags: string[]
  green_flags: string[]
}

export interface Report {
  id: string
  startup_id: string
  type: string
  status: ReportStatus
  /** FundabilityAnalysis when COMPLETED, { error } when FAILED, null when PENDING. */
  content?: (Partial<FundabilityAnalysis> & { error?: string }) | null
  created_at: string
}

export interface User {
  id: string
  email?: string | null
  full_name?: string | null
  role: string
}
