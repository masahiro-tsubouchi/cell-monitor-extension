from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from crud.crud_assignment_submission import (
    create_assignment_submission,
    get_assignment_submission,
    update_assignment_submission,
    delete_assignment_submission,
)
from db.session import get_db
from schemas.lms import (
    AssignmentSubmissionCreate,
    AssignmentSubmissionResponse,
    AssignmentSubmissionUpdate,
)
from db.models import AssignmentSubmission

router = APIRouter()


@router.post(
    "/",
    response_model=AssignmentSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_submission_endpoint(
    submission_in: AssignmentSubmissionCreate, db: Session = Depends(get_db)
):
    """
    新しい提出を作成する
    """
    return create_assignment_submission(db=db, submission_in=submission_in)


@router.get("/{submission_id}", response_model=AssignmentSubmissionResponse)
def get_submission_endpoint(submission_id: int, db: Session = Depends(get_db)):
    """
    指定されたIDの提出を取得する
    """
    db_submission = get_assignment_submission(db=db, submission_id=submission_id)
    if db_submission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Submission with id {submission_id} not found",
        )
    return db_submission


@router.get("/", response_model=List[AssignmentSubmissionResponse])
def list_submissions_endpoint(
    skip: int = 0,
    limit: int = 100,
    assignment_id: Optional[int] = Query(
        None, description="Filter submissions by assignment ID"
    ),
    student_id: Optional[int] = Query(
        None, description="Filter submissions by student ID"
    ),
    db: Session = Depends(get_db),
):
    """
    提出一覧を取得する（オプションで課題別・学生別フィルタリング）
    """
    query = db.query(AssignmentSubmission)

    # 課題別フィルタリング
    if assignment_id is not None:
        query = query.filter(AssignmentSubmission.assignment_id == assignment_id)

    # 学生別フィルタリング
    if student_id is not None:
        query = query.filter(AssignmentSubmission.student_id == student_id)

    submissions = query.offset(skip).limit(limit).all()
    return submissions


@router.put("/{submission_id}", response_model=AssignmentSubmissionResponse)
def update_submission_endpoint(
    submission_id: int,
    submission_update: AssignmentSubmissionUpdate,
    db: Session = Depends(get_db),
):
    """
    指定されたIDの提出を更新する（採点など）
    """
    db_submission = update_assignment_submission(
        db=db, submission_id=submission_id, submission_update=submission_update
    )
    if db_submission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Submission with id {submission_id} not found",
        )
    return db_submission


@router.delete("/{submission_id}", response_model=AssignmentSubmissionResponse)
def delete_submission_endpoint(submission_id: int, db: Session = Depends(get_db)):
    """
    指定されたIDの提出を削除する
    """
    db_submission = delete_assignment_submission(db=db, submission_id=submission_id)
    if db_submission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Submission with id {submission_id} not found",
        )
    return db_submission
