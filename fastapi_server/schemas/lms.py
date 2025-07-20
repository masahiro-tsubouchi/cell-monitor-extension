from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ClassBase(BaseModel):
    name: str
    class_code: str
    description: Optional[str] = None


class ClassCreate(ClassBase):
    pass


class ClassUpdate(BaseModel):
    name: Optional[str] = None
    class_code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ClassResponse(ClassBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# 後方互換性のためのエイリアス
Class = ClassResponse


# ClassAssignment schemas
class ClassAssignmentBase(BaseModel):
    class_id: int
    notebook_id: int
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    points: Optional[float] = None


class ClassAssignmentCreate(ClassAssignmentBase):
    pass


class ClassAssignmentUpdate(BaseModel):
    class_id: Optional[int] = None
    notebook_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    points: Optional[float] = None


class ClassAssignmentResponse(ClassAssignmentBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# 後方互換性のためのエイリアス
ClassAssignment = ClassAssignmentResponse


# AssignmentSubmission schemas
class AssignmentSubmissionBase(BaseModel):
    assignment_id: int
    student_id: int
    status: Optional[str] = "submitted"
    grade: Optional[float] = None
    feedback: Optional[str] = None


class AssignmentSubmissionCreate(AssignmentSubmissionBase):
    pass


class AssignmentSubmissionUpdate(BaseModel):
    assignment_id: Optional[int] = None
    student_id: Optional[int] = None
    status: Optional[str] = None
    grade: Optional[float] = None
    feedback: Optional[str] = None


class AssignmentSubmissionResponse(AssignmentSubmissionBase):
    id: int
    submitted_at: datetime

    class Config:
        from_attributes = True


# 後方互換性のためのエイリアス
AssignmentSubmission = AssignmentSubmissionResponse
