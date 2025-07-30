from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session

from crud.crud_instructor import (
    authenticate_instructor,
    update_instructor_password,
    update_instructor_status,
)
from db.session import get_db
from schemas.instructor import (
    InstructorLogin,
    InstructorPasswordUpdate,
    InstructorResponse,
    LoginResponse,
    TokenResponse,
    InstructorStatusUpdate,
)
from core.security import create_access_token, get_current_instructor
from core.config import settings
from db.models import InstructorStatus

router = APIRouter()
security = HTTPBearer()


@router.post("/login", response_model=LoginResponse)
def login_instructor(login_data: InstructorLogin, db: Session = Depends(get_db)):
    """
    講師ログイン
    """
    # 講師認証
    instructor = authenticate_instructor(
        db=db, email=login_data.email, password=login_data.password
    )

    if not instructor:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # アクセストークンを生成
    access_token = create_access_token(data={"sub": instructor.email})

    # ログイン時にステータスを更新
    status_update = InstructorStatusUpdate(status=InstructorStatus.AVAILABLE)
    updated_instructor = update_instructor_status(db, instructor.id, status_update)

    # レスポンス作成
    token_response = TokenResponse(
        access_token=access_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # 秒単位に変換
    )

    return LoginResponse(
        instructor=InstructorResponse.model_validate(updated_instructor),
        token=token_response,
    )


@router.get("/me", response_model=InstructorResponse)
def get_current_instructor_info(current_instructor=Depends(get_current_instructor)):
    """
    現在の講師情報を取得
    """
    return InstructorResponse.model_validate(current_instructor)


@router.put("/password")
def change_password(
    password_data: InstructorPasswordUpdate,
    db: Session = Depends(get_db),
    current_instructor=Depends(get_current_instructor),
):
    """
    パスワード変更
    """
    # パスワード更新
    updated_instructor = update_instructor_password(
        db=db, instructor_id=current_instructor.id, password_update=password_data
    )

    if not updated_instructor:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    return {"message": "Password updated successfully"}


@router.post("/logout")
def logout_instructor(
    db: Session = Depends(get_db), current_instructor=Depends(get_current_instructor)
):
    """
    講師ログアウト
    """
    # ログアウト時にステータスをオフラインに更新
    status_update = InstructorStatusUpdate(status=InstructorStatus.OFFLINE)
    update_instructor_status(db, current_instructor.id, status_update)

    return {"message": "Successfully logged out"}
