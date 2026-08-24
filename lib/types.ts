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

export type Stage = "PRE_SEED" | "SEED" | "SERIES_A"

export interface StartupSummary {
  id: string
  name?: string | null
  one_liner?: string | null
  slug?: string | null
  stage?: Stage | string | null
  industry?: string[] | null
  /** Latest COMPLETED fundability score, or null if never scored. */
  latest_score?: number | null
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

export type ReportType = "FUNDABILITY_SCORE" | "INVESTMENT_MEMO" | "PITCH_DECK"

export interface MemoSection {
  title: string
  content: string
}

export interface InvestmentMemo {
  sections: MemoSection[]
  recommendation: string
}

export interface Slide {
  title: string
  bullets: string[]
  speaker_notes: string
}

export interface PitchDeck {
  title: string
  subtitle: string
  slides: Slide[]
}

/** The union of every report body, discriminated by Report["type"]. */
export type ReportContent = Partial<FundabilityAnalysis> &
  Partial<InvestmentMemo> &
  Partial<PitchDeck> & { error?: string }

export interface Report {
  id: string
  startup_id: string
  type: ReportType | string
  status: ReportStatus
  /** Shape depends on `type`; { error } when FAILED, null when PENDING. */
  content?: ReportContent | null
  score_summary?: { total_score?: number; breakdown?: ScoreBreakdown } | null
  created_at: string
}

export interface InvestorViewSection {
  title: string
  content: string
}

export interface InvestorViewContent {
  angle: string
  sections: InvestorViewSection[]
  metrics_to_lead_with: string[]
  talking_points: string[]
}

export interface InvestorView {
  id: string
  startup_id: string
  investor_name: string
  investor_thesis?: string | null
  status: ReportStatus
  content?: (Partial<InvestorViewContent> & { error?: string }) | null
  created_at: string
}

export interface DeckUploadResult {
  status: string
  fields_filled: string[]
  notes: string
}

export interface User {
  id: string
  email?: string | null
  full_name?: string | null
  role: string
}
