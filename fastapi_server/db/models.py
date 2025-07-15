from sqlalchemy import Column, String, Integer

from db.base_class import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True, nullable=False)
    # 今後、生徒名などの他の情報も追加可能
    # name = Column(String)
