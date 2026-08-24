import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

# NOTE ON RANGES: score bounds are stated in the field descriptions rather than
# as Field(ge=..., le=...). ge/le render as "minimum"/"maximum" in the generated
# JSON Schema, and schema-constrained structured output accepts a restricted
# keyword set - an unsupported keyword is a 400 you would only discover at
# analysis time. Ranges are enforced by clamping in Python after parsing.


class ScoreBreakdown(BaseModel):
    market_opportunity: int = Field(description="Integer 0-10. Size and timing of the market.")
    product_solution: int = Field(description="Integer 0-10. Quality and differentiation of the product.")
    traction_execution: int = Field(description="Integer 0-10. Evidence the team ships and customers care.")
    team: int = Field(description="Integer 0-10. Founder-market fit and demonstrated execution.")
    moat_risks: int = Field(description="Integer 0-10. Defensibility net of the risks identified.")


class FundabilityAnalysis(BaseModel):
    total_score: int = Field(description="Integer 0-100. Overall fundability score.")
    breakdown: ScoreBreakdown
    summary: str = Field(description="Two to four sentence executive summary of the investment case.")
    red_flags: List[str] = Field(description="Critical risks, gaps or weaknesses. Each a single sentence.")
    green_flags: List[str] = Field(description="Key strengths and positive signals. Each a single sentence.")


class InvestmentMemoSection(BaseModel):
    title: str
    content: str


class InvestmentMemo(BaseModel):
    sections: List[InvestmentMemoSection]
    recommendation: str = Field(description="Pass or Investigate")


class InvestorView(BaseModel):
    investor_name: str
    customized_pitch: str


# --- API models -----------------------------------------------------------


class ReportOut(BaseModel):
    id: uuid.UUID
    startup_id: uuid.UUID
    type: str
    status: str
    content: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AnalysisTriggerResponse(BaseModel):
    report_id: uuid.UUID
    status: str
