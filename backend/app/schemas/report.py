from typing import List, Dict, Optional
from pydantic import BaseModel, Field

class ScoreBreakdown(BaseModel):
    market_opportunity: int
    product_solution: int
    traction_execution: int
    team: int
    moat_risks: int

class FundabilityAnalysis(BaseModel):
    total_score: int = Field(..., description="0-100 overall fundability score")
    breakdown: ScoreBreakdown
    summary: str = Field(..., description="Executive summary of the analysis")
    red_flags: List[str] = Field(..., description="Critical risks or weaknesses")
    green_flags: List[str] = Field(..., description="Key strengths and signals")
    
class InvestmentMemoSection(BaseModel):
    title: str
    content: str

class InvestmentMemo(BaseModel):
    sections: List[InvestmentMemoSection]
    recommendation: str = Field(..., description="Pass or Investigate")

class InvestorView(BaseModel):
    investor_name: str
    customized_pitch: str
