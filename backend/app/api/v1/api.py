from fastapi import APIRouter
from app.api.v1.endpoints import analysis, auth, public, startups, users

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(startups.router, prefix="/startups", tags=["startups"])
api_router.include_router(analysis.router, prefix="/analysis", tags=["analysis"])
# Unauthenticated by design - see app/api/v1/endpoints/public.py.
api_router.include_router(public.router, prefix="/public", tags=["public"])
