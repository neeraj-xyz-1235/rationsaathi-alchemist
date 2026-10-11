"""POST /api/receipt/parse (plan_backend.txt 2.3). Public but rate-limited because the LLM path
can cost money. Never saves anything: suggestions become records only after the user confirms."""
from fastapi import APIRouter, Depends, Request

from app.auth import rate_limit as rl
from app.auth.deps import optional_user
from app.db.models import User
from app.parser.service import parse_receipt
from app.schemas import ParseRequest, ParseResponse

router = APIRouter(prefix="/api")


def limit_parse(request: Request, user: User | None = Depends(optional_user)) -> None:
    if user is not None:
        wait = rl.parse_user_limiter.hit(str(user.id))          # 30 / min per logged-in user
    else:
        wait = rl.parse_ip_limiter.hit(rl.client_ip(request))   # 10 / min per IP
    if wait:
        raise rl.too_many(wait)


@router.post("/receipt/parse", response_model=ParseResponse, dependencies=[Depends(limit_parse)])
def parse(body: ParseRequest):
    method, suggestions = parse_receipt(body.text, body.period.start, body.period.end,
                                        body.known_items)
    return {"method": method, "raw_text": body.text, "suggestions": suggestions}
