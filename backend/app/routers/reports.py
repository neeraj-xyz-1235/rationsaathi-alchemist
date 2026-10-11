"""Frozen report snapshots (plan_backend.txt 2.4). A report shows exactly what was generated,
even if the case is edited later. Viewing needs only the unguessable link."""
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.deps import current_user
from app.auth.sessions import as_utc, now
from app.db import mapping
from app.db import models as m
from app.db.session import get_db
from app.engine.calculator import calculate
from app.auth import rate_limit as rl
from app.config import settings
from app.db.session import SessionLocal
from app.email import render as email_render
from app.email import sender as email_sender
from app.errors import error_response
from app.routers.cases import get_owned_case
from app.schemas import EmailQueued, EmailRequest, ReportCreated, ReportOut

router = APIRouter(prefix="/api")
log = logging.getLogger("rationsaathi.email")


@router.post("/cases/{case_id}/reports", status_code=201, response_model=ReportCreated)
def create_report(case_id: str, user: m.User = Depends(current_user),
                  db: Session = Depends(get_db)):
    row = get_owned_case(db, case_id, user)
    case = mapping.to_schema(db, row)
    result = calculate(case)                    # same engine as /api/calculate
    report = m.Report(case_id=row.id, generated_at=now(),
                      case_snapshot=case.model_dump(mode="json"), result=result)
    db.add(report)
    db.commit()
    return {"report_id": str(report.id), "case": case.model_dump(mode="json"), "result": result}


@router.get("/reports/{report_id}", response_model=ReportOut)
def get_report(report_id: str, db: Session = Depends(get_db)):
    rid = mapping.parse_id(report_id)
    report = db.get(m.Report, rid) if rid else None
    if report is None:
        raise HTTPException(404, "NOT_FOUND")
    return {"report_id": str(report.id),
            "generated_at": as_utc(report.generated_at).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "case": report.case_snapshot, "result": report.result}


def deliver_report_email(log_id: int, to: str, report_id, lang: str) -> None:
    """Runs after the response was sent. Records sent / failed; never raises, never logs the body."""
    status, code = "sent", None
    try:
        with SessionLocal() as db:
            report = db.get(m.Report, report_id)
            link = f"{settings.APP_ORIGIN.rstrip('/')}/r/{report_id}"
            subject, html, text = email_render.build(report.result, lang, link)
        email_sender.send(to, subject, html, text)
    except email_sender.EmailSendError as e:
        status, code = "failed", e.code
    except Exception as e:  # noqa: BLE001
        status, code = "failed", "RENDER_ERROR"
        log.warning("email build failed (%s)", type(e).__name__)
    with SessionLocal() as db:
        row = db.get(m.EmailLog, log_id)
        if row is not None:
            row.status, row.error_code = status, code
            db.commit()
    log.info("report email %s report=%s code=%s", status, report_id, code)


@router.post("/reports/{report_id}/email", status_code=202, response_model=EmailQueued)
def email_report(report_id: str, body: EmailRequest, background: BackgroundTasks,
                 user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    """Always sends to the logged-in user's OWN account email: the request has no recipient,
    subject or body field, so this cannot be used as a spam relay."""
    rid = mapping.parse_id(report_id)
    report = db.get(m.Report, rid) if rid else None
    case = db.get(m.Case, report.case_id) if report else None
    if report is None or case is None or case.user_id != user.id:
        raise HTTPException(404, "NOT_FOUND")                  # same answer as "does not exist"
    if not email_sender.is_configured():
        return error_response(503, "EMAIL_NOT_CONFIGURED")
    rl.check_email_allowed(db, user.id)                         # 429 + Retry-After
    rl.cleanup_old_email_log(db)
    entry = m.EmailLog(user_id=user.id, report_id=report.id, kind="report", status="queued",
                       created_at=now())
    db.add(entry)
    db.commit()
    background.add_task(deliver_report_email, entry.id, user.email, report.id, body.lang)
    return {"status": "queued", "sent_to": email_render.mask_email(user.email)}
