import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

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
    # Confidence is about the EVIDENCE, not the verdict. A thin profile can be
    # scored low with high confidence; what it cannot be is scored precisely.
    # Without this a score read off two sentences looks as authoritative as one
    # read off a full profile.
    confidence: Literal["LOW", "MEDIUM", "HIGH"] = Field(
        description=(
            "How much of this profile was actually evidenced. HIGH: most claims "
            "are specific and quantified. MEDIUM: the shape is clear but key "
            "numbers are missing. LOW: too little to judge on, and the score is "
            "closer to a guess."
        )
    )
    top_fixes: List[str] = Field(
        description=(
            "Two to four changes that would move this score most, hardest-hitting "
            "first. Each names the specific gap and what would close it. Not "
            "generic advice."
        )
    )


class InvestmentMemoSection(BaseModel):
    title: str
    content: str


class InvestmentMemo(BaseModel):
    sections: List[InvestmentMemoSection]
    recommendation: str = Field(description="Either 'Pass' or 'Investigate'.")


class Slide(BaseModel):
    title: str = Field(description="Slide headline. Six words or fewer.")
    bullets: List[str] = Field(
        description="Three to five bullets. Each one line, specific, no marketing adjectives."
    )
    speaker_notes: str = Field(
        description="What the founder says out loud on this slide. Two or three sentences."
    )


class PitchDeck(BaseModel):
    """The irony is deliberate: NoDeck generates the deck as an OUTPUT of the
    Intelligence Profile, rather than making the founder start from one."""

    title: str = Field(description="Deck title - usually the company name.")
    subtitle: str = Field(description="One-line positioning statement.")
    slides: List[Slide] = Field(
        description=(
            "Ten to twelve slides in standard order: Problem, Solution, Why Now, "
            "Market, Product, Business Model, Traction, Competition, Team, The Ask."
        )
    )


class InvestorViewSection(BaseModel):
    title: str = Field(description="Section name, e.g. 'Problem' or 'Market'.")
    content: str = Field(description="The section rewritten for this investor.")


class InvestorViewContent(BaseModel):
    angle: str = Field(
        description="One sentence naming the specific angle taken for this investor."
    )
    sections: List[InvestorViewSection] = Field(
        description="The reframed Problem and Market sections, plus any others worth retelling."
    )
    metrics_to_lead_with: List[str] = Field(
        description="The metrics from the SIP this investor will care about most."
    )
    talking_points: List[str] = Field(
        description="Short points the founder should make in the first meeting."
    )


class ParsedDeckSIP(BaseModel):
    """What we could recover from an uploaded PDF. Every field optional: a deck
    routinely omits half of these, and a hallucinated TAM is worse than a gap."""

    one_liner: Optional[str] = Field(default=None, description="Company one-liner if stated.")
    problem_description: Optional[str] = None
    pain_points: List[str] = Field(default_factory=list)
    solution_description: Optional[str] = None
    product_name: Optional[str] = None
    value_proposition: Optional[str] = None
    moat: Optional[str] = None
    tech_stack: List[str] = Field(default_factory=list)
    tam: Optional[float] = Field(default=None, description="Total addressable market in USD.")
    sam: Optional[float] = Field(default=None, description="Serviceable available market in USD.")
    som: Optional[float] = Field(default=None, description="Obtainable market in USD.")
    target_customer_persona: Optional[str] = None
    milestones: List[str] = Field(default_factory=list)
    customer_logos: List[str] = Field(default_factory=list)
    round_stage: Optional[str] = None
    ask_amount: Optional[float] = Field(default=None, description="Amount being raised, USD.")
    use_of_funds: Optional[str] = None
    notes: str = Field(
        default="",
        description="One sentence on what the deck did NOT contain, for the founder to fill in.",
    )


# --- API models -----------------------------------------------------------


class ReportOut(BaseModel):
    id: uuid.UUID
    startup_id: uuid.UUID
    type: str
    status: str
    content: Optional[Dict[str, Any]] = None
    score_summary: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AnalysisTriggerResponse(BaseModel):
    report_id: uuid.UUID
    status: str


class InvestorViewCreate(BaseModel):
    investor_name: str = Field(min_length=1, max_length=120)
    investor_thesis: Optional[str] = Field(default=None, max_length=2000)


class InvestorViewTriggerResponse(BaseModel):
    view_id: uuid.UUID
    status: str


class InvestorViewOut(BaseModel):
    id: uuid.UUID
    startup_id: uuid.UUID
    investor_name: str
    investor_thesis: Optional[str] = None
    status: str
    content: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DeckUploadResponse(BaseModel):
    status: str
    fields_filled: List[str]
    notes: str
