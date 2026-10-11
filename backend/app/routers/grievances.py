"""Grievance notes (plan_backend.txt 2.9): the user's OWN diary of any complaint they raise.
We never contact a government portal and never file anything for them.
Ownership is checked through the case: someone else's case or note is a plain 404."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.auth.deps import current_user
from app.auth.sessions import as_utc, now
from app.db import mapping
from app.db import models as m
from app.db.session import get_db
from app.routers.cases import get_owned_case
from app.schemas import CaseCreated, GrievanceIn, GrievanceOut

router = APIRouter(prefix="/api/cases/{case_id}/grievances")


def _iso(dt) -> str:
    return as_utc(dt).strftime("%Y-%m-%dT%H:%M:%SZ")


def _out(n: m.GrievanceNote) -> dict:
    return {"id": str(n.id), "portal_key": n.portal_key, "reference_no": n.reference_no,
            "filed_on": n.filed_on, "status": n.status, "note": n.note,
            "created_at": _iso(n.created_at), "updated_at": _iso(n.updated_at)}


def _get_note(db: Session, case: m.Case, raw_id: str) -> m.GrievanceNote:
    gid = mapping.parse_id(raw_id)
    note = db.query(m.GrievanceNote).filter_by(id=gid, case_id=case.id).first() if gid else None
    if note is None:
        raise HTTPException(404, "NOT_FOUND")
    return note


@router.get("", response_model=list[GrievanceOut])
def list_notes(case_id: str, user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    case = get_owned_case(db, case_id, user)
    rows = db.query(m.GrievanceNote).filter_by(case_id=case.id).order_by(
        m.GrievanceNote.created_at, m.GrievanceNote.id).all()
    return [_out(n) for n in rows]


@router.post("", status_code=201, response_model=CaseCreated)
def create_note(case_id: str, body: GrievanceIn, user: m.User = Depends(current_user),
                db: Session = Depends(get_db)):
    case = get_owned_case(db, case_id, user)
    note = m.GrievanceNote(id=uuid.uuid4(), case_id=case.id, created_at=now(), updated_at=now(),
                           **body.model_dump())
    db.add(note)
    db.commit()
    return {"id": str(note.id)}


@router.put("/{note_id}", response_model=GrievanceOut)
def replace_note(case_id: str, note_id: str, body: GrievanceIn,
                 user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    note = _get_note(db, get_owned_case(db, case_id, user), note_id)
    for field, value in body.model_dump().items():
        setattr(note, field, value)
    note.updated_at = now()
    db.commit()
    return _out(note)


@router.delete("/{note_id}", status_code=204)
def delete_note(case_id: str, note_id: str, user: m.User = Depends(current_user),
                db: Session = Depends(get_db)):
    note = _get_note(db, get_owned_case(db, case_id, user), note_id)
    db.delete(note)
    db.commit()
    return Response(status_code=204)
