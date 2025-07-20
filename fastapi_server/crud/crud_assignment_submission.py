from sqlalchemy.orm import Session

from db.models import AssignmentSubmission
from schemas.lms import AssignmentSubmissionCreate, AssignmentSubmissionUpdate


def create_assignment_submission(
    db: Session, submission_in: AssignmentSubmissionCreate
) -> AssignmentSubmission:
    """
    新しい課題提出を作成してデータベースに保存する
    """
    db_submission = AssignmentSubmission(
        assignment_id=submission_in.assignment_id,
        student_id=submission_in.student_id,
        status=submission_in.status,
        grade=submission_in.grade,
        feedback=submission_in.feedback,
    )
    db.add(db_submission)
    db.commit()
    db.refresh(db_submission)
    return db_submission


def get_assignment_submission(db: Session, submission_id: int) -> AssignmentSubmission:
    """
    IDで課題提出を取得する
    """
    return (
        db.query(AssignmentSubmission)
        .filter(AssignmentSubmission.id == submission_id)
        .first()
    )


def update_assignment_submission(
    db: Session, submission_id: int, submission_update: AssignmentSubmissionUpdate
) -> AssignmentSubmission:
    """
    課題提出情報を更新する
    """
    db_submission = (
        db.query(AssignmentSubmission)
        .filter(AssignmentSubmission.id == submission_id)
        .first()
    )
    if not db_submission:
        return None

    # 更新データを辞書に変換し、None以外の値のみを取得
    update_data = submission_update.dict(exclude_unset=True)

    # 各フィールドを更新
    for field, value in update_data.items():
        if hasattr(db_submission, field):
            setattr(db_submission, field, value)

    db.commit()
    db.refresh(db_submission)
    return db_submission


def delete_assignment_submission(
    db: Session, submission_id: int
) -> AssignmentSubmission:
    """
    課題提出を削除する
    """
    db_submission = (
        db.query(AssignmentSubmission)
        .filter(AssignmentSubmission.id == submission_id)
        .first()
    )
    if not db_submission:
        return None

    db.delete(db_submission)
    db.commit()
    return db_submission
