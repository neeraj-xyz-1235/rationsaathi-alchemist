"""Monthly household report: JSON, PDF download, and email to the account's own address."""
import html
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Response
from sqlalchemy.orm import Session

from app.auth import rate_limit as rl
from app.auth.deps import current_user
from app.auth.sessions import now
from app.db import models as m
from app.db.session import SessionLocal, get_db
from app.documents import pdf
from app.documents import report as doc
from app.email import render as email_render
from app.email import sender as email_sender
from app.errors import error_response
from app.schemas import EmailQueued, MonthlyReportEmail

router = APIRouter(prefix="/api/monthly-report")
log = logging.getLogger("rationsaathi.email")


@router.get("")
def report_json(month: str = Query(...), user: m.User = Depends(current_user),
                db: Session = Depends(get_db)):
    return {"report": doc.build(db, user, month)}


@router.get("/pdf")
def report_pdf(month: str = Query(...), user: m.User = Depends(current_user),
               db: Session = Depends(get_db)):
    data = pdf.report_pdf(doc.build(db, user, month))
    return Response(data, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="rationsaathi-report-{month}.pdf"',
        "Cache-Control": "no-store"})


def _deliver(log_id: int, to: str, subject: str, html_body: str, text: str,
             filename: str, data: bytes) -> None:
    status, code = "sent", None
    try:
        email_sender.send(to, subject, html_body, text, [(filename, data)])
    except email_sender.EmailSendError as e:
        status, code = "failed", e.code
    except Exception as e:  # noqa: BLE001
        status, code = "failed", "SEND_ERROR"
        log.warning("monthly report email failed (%s)", type(e).__name__)
    with SessionLocal() as db:
        row = db.get(m.EmailLog, log_id)
        if row is not None:
            row.status, row.error_code = status, code
            db.commit()
    log.info("monthly report email %s code=%s", status, code)


@router.post("/email", status_code=202, response_model=EmailQueued)
def email_report(body: MonthlyReportEmail, background: BackgroundTasks,
                 user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    """Always to the logged-in user's OWN email: the request has no recipient field."""
    report = doc.build(db, user, body.month)
    if not email_sender.is_configured():
        return error_response(503, "EMAIL_NOT_CONFIGURED")
    rl.check_email_allowed(db, user.id)
    rl.cleanup_old_email_log(db)
    entry = m.EmailLog(user_id=user.id, report_id=None, kind="report", status="queued",
                       created_at=now())
    db.add(entry)
    db.commit()
    label = report["period_label"]
    lines = [f'{i["item"]}: allocated {i["allocated"]} kg, withdrawn {i["withdrawn"]} kg, '
             f'remaining {i["remaining"]} kg' for i in report["items"]]
    text = (f"Hello,\n\nYour RationSaathi monthly report for {label} is attached as a PDF.\n\n"
            + "\n".join(lines) + "\n\nRationSaathi is an independent tool; the official scheme "
            "rules remain the source of truth.\n")
    html_body = (f"<p>Hello,</p><p>Your RationSaathi monthly report for {html.escape(label)} is "
                 "attached as a PDF.</p><ul>"
                 + "".join(f"<li>{html.escape(x)}</li>" for x in lines) + "</ul>"
                 "<p style='color:#666;font-size:12px'>RationSaathi is an independent tool; the "
                 "official scheme rules remain the source of truth.</p>")
    background.add_task(_deliver, entry.id, user.email, f"Your RationSaathi report: {label}",
                        html_body, text, f"rationsaathi-report-{body.month}.pdf",
                        pdf.report_pdf(report))
    return {"status": "queued", "sent_to": email_render.mask_email(user.email)}
