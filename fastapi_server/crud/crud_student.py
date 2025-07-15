from sqlalchemy.orm import Session

from db import models
from schemas import student as student_schema

def get_student_by_user_id(db: Session, user_id: str) -> models.Student | None:
    return db.query(models.Student).filter(models.Student.user_id == user_id).first()

def create_student(db: Session, student: student_schema.StudentCreate) -> models.Student:
    db_student = models.Student(user_id=student.user_id)
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    return db_student

def get_or_create_student(db: Session, user_id: str) -> models.Student:
    db_student = get_student_by_user_id(db, user_id=user_id)
    if not db_student:
        db_student = create_student(db, student_schema.StudentCreate(user_id=user_id))
    return db_student
