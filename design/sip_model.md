# Startup Intelligence Profile (SIP) Data Model

The SIP is the single source of truth for a startup. It is stored as a JSONB column in Postgres but strictly validated via Pydantic in the application layer.

## Pydantic Model Structure (Pseudocode)

```python
class Identity(BaseModel):
    name: str
    website: HttpUrl | None
    location: str
    founded_year: int
    contact_email: EmailStr

class Problem(BaseModel):
    description: str = Field(..., description="The core problem statement")
    pain_points: List[str] = Field(..., min_items=1)
    current_solutions: str = Field(..., description="How people solve it now")
    validated: bool = False

class Solution(BaseModel):
    product_name: str
    description: str
    value_proposition: str
    tech_stack: List[str]
    moat: str = Field(..., description="Defensibility / IP")

class Market(BaseModel):
    tam: int = Field(..., description="Total Addressable Market in USD")
    sam: int
    som: int
    market_growth_rate: float
    target_customer_persona: str

class Traction(BaseModel):
    metrics: Dict[str, float]  # e.g. {"MRR": 1000, "DAU": 500}
    milestones: List[str]
    customer_logos: List[str]

class TeamMember(BaseModel):
    name: str
    role: str
    linkedin: HttpUrl | None
    bio: str
    superpower: str

class Fundraising(BaseModel):
    round_stage: str  # Pre-seed, Seed, A
    ask_amount: int
    use_of_funds: str
    valuation_cap: int | None

class StartupIntelligenceProfile(BaseModel):
    identity: Identity
    problem: Problem
    solution: Solution
    market: Market
    traction: Traction
    team: List[TeamMember]
    fundraising: Fundraising
    
    # AI-Generated Fields (Computed)
    fundability_score: int | None
    risks: List[str] | None
    strengths: List[str] | None
```
