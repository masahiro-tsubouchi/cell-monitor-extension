from pydantic import BaseModel

# ベースとなるスキーマ
class StudentBase(BaseModel):
    user_id: str

# 生徒作成時に使用するスキーマ
class StudentCreate(StudentBase):
    pass

# DBから読み取ったデータを表現するスキーマ
class Student(StudentBase):
    id: int

    class Config:
        from_attributes = True # orm_mode = True for pydantic v1
