import instructor
from openai import AsyncOpenAI
from app.core.config import settings
from app.schemas.startup import StartupIntelligenceProfile
from app.schemas.report import FundabilityAnalysis, InvestmentMemo

# Initialize client with Instructor
# Note: For production, we should handle provider switching here
client = instructor.from_openai(AsyncOpenAI(api_key=settings.OPENAI_API_KEY))

class AIService:
    @staticmethod
    async def analyze_fundability(sip: StartupIntelligenceProfile) -> FundabilityAnalysis:
        prompt = f"""
        You are a General Partner at a top-tier venture capital firm (like Sequoia or Benchmark). 
        You are cynical, data-driven, and looking for outlier returns.
        
        Evaluate this startup based on their profile:
        {sip.model_dump_json()}
        
        Score them strictly. Most startups fail. Be realistic.
        30 is average. 70 is Series A ready. 90 is a Unicorn in making.
        """
        
        return await client.chat.completions.create(
            model="gpt-4-turbo-preview",
            response_model=FundabilityAnalysis,
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.2
        )

    @staticmethod
    async def generate_memo(sip: StartupIntelligenceProfile) -> InvestmentMemo:
        prompt = f"""
        Write an internal VC Investment Memo for this startup:
        {sip.model_dump_json()}
        
        Structure it professionally. Be objective.
        """
        
        return await client.chat.completions.create(
            model="gpt-4-turbo-preview",
            response_model=InvestmentMemo,
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.4
        )

ai_service = AIService()
