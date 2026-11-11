from fastapi import APIRouter, Request

from lib.auth import authorize_profile
from lib.credits import get_status, owner_key
from models.account import CreditStatus

router = APIRouter(prefix="/credits", tags=["credits"])


@router.get("/status/{profile_id}", response_model=CreditStatus)
async def credit_status(profile_id: str, request: Request) -> CreditStatus:
    await authorize_profile(request, profile_id)
    owner, is_user = owner_key(profile_id)
    return await get_status(owner, is_user)
