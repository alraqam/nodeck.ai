import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict

# --- SIP components -------------------------------------------------------
#
# Field names follow design/sip_model.md, which is canonical. Where
# design/database_schema.md disagrees (total_addressable_market vs tam, etc.)
# it is the stale document.
#
# Every field is Optional. The SIP is a draft document a founder fills in over
# several sittings - a half-completed section must not 422 the whole save.


class Identity(BaseModel):
    website: Optional[str] = None
    location: Optional[str] = None
    founded_year: Optional[int] = None
    contact_email: Optional[str] = None
    # `name` from sip_model.md is deliberately omitted: it duplicates the
    # startups.name column, which is the single source of truth.


class Problem(BaseModel):
    description: Optional[str] = None
    pain_points: List[str] = []
    current_solutions: Optional[str] = None
    validated: bool = False


class Solution(BaseModel):
    product_name: Optional[str] = None
    description: Optional[str] = None
    value_proposition: Optional[str] = None
    tech_stack: List[str] = []
    moat: Optional[str] = None


class Market(BaseModel):
    tam: Optional[int] = None
    sam: Optional[int] = None
    som: Optional[int] = None
    market_growth_rate: Optional[float] = None
    target_customer_persona: Optional[str] = None


class Traction(BaseModel):
    metrics: Dict[str, float] = {}
    milestones: List[str] = []
    customer_logos: List[str] = []


class TeamMember(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    linkedin: Optional[str] = None
    bio: Optional[str] = None
    superpower: Optional[str] = None


class Fundraising(BaseModel):
    round_stage: Optional[str] = None
    ask_amount: Optional[int] = None
    valuation_cap: Optional[int] = None
    use_of_funds: Optional[str] = None


class StartupIntelligenceProfile(BaseModel):
    """The full profile, as handed to the LLM."""

    identity: Identity = Identity()
    problem: Problem = Problem()
    solution: Solution = Solution()
    market: Market = Market()
    traction: Traction = Traction()
    team: List[TeamMember] = []
    fundraising: Fundraising = Fundraising()


class SIPUpdate(BaseModel):
    """Partial SIP update.

    Every section defaults to None so the handler can use exclude_unset to tell
    "the client did not send this section" apart from "the client cleared it".
    Sections that ARE sent are replaced wholesale.
    """

    identity: Optional[Identity] = None
    problem: Optional[Problem] = None
    solution: Optional[Solution] = None
    market: Optional[Market] = None
    traction: Optional[Traction] = None
    team: Optional[List[TeamMember]] = None
    fundraising: Optional[Fundraising] = None


# --- API models -----------------------------------------------------------


class StartupBase(BaseModel):
    name: Optional[str] = None
    one_liner: Optional[str] = None
    # PRE_SEED | SEED | SERIES_A per database_schema.md.
    stage: Optional[str] = None
    # Optional, not `= []`: the column is nullable and a startup created
    # without industries stores NULL, which a bare List[str] rejects on the
    # way back out.
    industry: Optional[List[str]] = None


class StartupCreate(StartupBase):
    name: str
    # `slug` is generated server-side. It is globally unique, so letting the
    # client derive it from the name collides the moment two founders both
    # register an "Acme".


class StartupUpdate(BaseModel):
    """Edit the basics. Every field optional so a PATCH can carry just one.

    `slug` is intentionally not updatable: it is referenced externally and
    rewriting it would break any link already shared with an investor.
    """

    name: Optional[str] = None
    one_liner: Optional[str] = None
    stage: Optional[str] = None
    industry: Optional[List[str]] = None


class ShareSettings(BaseModel):
    """What the founder controls about a shared link."""

    enabled: bool
    # Absent when sharing is off - there is no token to hand back.
    share_token: Optional[str] = None
    include_score: bool = False


class ShareUpdate(BaseModel):
    include_score: Optional[bool] = None


class StartupSummary(StartupBase):
    """List view - omits the (potentially large) SIP blob."""

    id: uuid.UUID
    slug: Optional[str] = None
    created_at: datetime
    # Latest COMPLETED fundability score, or None. Filled by the list
    # endpoint from reports.score_summary so the dashboard avoids an N+1.
    latest_score: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class Startup(StartupBase):
    id: uuid.UUID
    founder_id: uuid.UUID
    slug: Optional[str] = None
    share_token: Optional[str] = None
    share_score: bool = False
    # Loosely typed on the way out; strictly validated on the way in.
    sip_data: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
