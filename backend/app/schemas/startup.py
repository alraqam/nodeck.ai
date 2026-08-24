from typing import List, Optional, Any, Dict
from pydantic import BaseModel, ConfigDict
import uuid
from datetime import datetime

# --- SIP Components ---

class Identity(BaseModel):
    website: Optional[str] = None
    location: Optional[str] = None
    founded_year: Optional[int] = None

class Problem(BaseModel):
    description: Optional[str] = None
    pain_points: List[str] = []
    current_solutions: Optional[str] = None

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

class TeamMember(BaseModel):
    name: str
    role: str
    linkedin: Optional[str] = None
    bio: Optional[str] = None

class Fundraising(BaseModel):
    round_stage: Optional[str] = None
    ask_amount: Optional[int] = None
    valuation_cap: Optional[int] = None
    use_of_funds: Optional[str] = None

class StartupIntelligenceProfile(BaseModel):
    identity: Identity = Identity()
    problem: Problem = Problem()
    solution: Solution = Solution()
    market: Market = Market()
    traction: Traction = Traction()
    team: List[TeamMember] = []
    fundraising: Fundraising = Fundraising()

# --- Shared Properties ---

class StartupBase(BaseModel):
    name: Optional[str] = None
    one_liner: Optional[str] = None
    slug: Optional[str] = None

# --- API Models ---

class StartupCreate(StartupBase):
    name: str
    slug: str

class StartupUpdate(StartupBase):
    pass

class StartupUpdateSIP(BaseModel):
    sip_data: StartupIntelligenceProfile

class Startup(StartupBase):
    id: uuid.UUID
    founder_id: uuid.UUID
    sip_data: Optional[Dict[str, Any]] = None # Loose typing for JSONB but validated on input
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
