"""
講師ログイン機能のセキュリティ機能実装

Phase 2: 認証・セキュリティ
- パスワードハッシュ化（bcrypt）
- JWT トークン生成・検証
- 依存性注入による認証チェック
"""

from datetime import datetime, timedelta
from typing import Optional, Union
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from core.config import settings
from db.models import Instructor
from db.session import get_db

# パスワードハッシュ化コンテキスト
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT認証スキーム
security = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    プレーンテキストパスワードとハッシュ化パスワードを比較

    Args:
        plain_password: プレーンテキストパスワード
        hashed_password: ハッシュ化されたパスワード

    Returns:
        bool: パスワードが一致する場合True
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    パスワードをハッシュ化

    Args:
        password: プレーンテキストパスワード

    Returns:
        str: ハッシュ化されたパスワード
    """
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    JWTアクセストークンを生成

    Args:
        data: トークンに含めるデータ
        expires_delta: 有効期限（指定しない場合はデフォルト値を使用）

    Returns:
        str: JWTアクセストークン
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def verify_token(token: str) -> Optional[dict]:
    """
    JWTトークンを検証してペイロードを返す

    Args:
        token: JWTトークン

    Returns:
        dict: トークンのペイロード（無効な場合はNone）
    """
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError:
        return None


def authenticate_instructor(
    db: Session, email: str, password: str
) -> Optional[Instructor]:
    """
    講師の認証を行う

    Args:
        db: データベースセッション
        email: メールアドレス
        password: パスワード

    Returns:
        Instructor: 認証成功時の講師オブジェクト（失敗時はNone）
    """
    instructor = db.query(Instructor).filter(Instructor.email == email).first()
    if not instructor:
        return None
    if not instructor.is_active:
        return None
    if not verify_password(password, instructor.password_hash):
        return None
    return instructor


async def get_current_instructor(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> Instructor:
    """
    現在の認証済み講師を取得する依存性注入関数

    Args:
        credentials: HTTPベアラー認証の資格情報
        db: データベースセッション

    Returns:
        Instructor: 現在の講師オブジェクト

    Raises:
        HTTPException: 認証に失敗した場合
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        token = credentials.credentials
        payload = verify_token(token)
        if payload is None:
            raise credentials_exception

        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    instructor = db.query(Instructor).filter(Instructor.email == email).first()
    if instructor is None:
        raise credentials_exception

    return instructor


async def get_current_active_instructor(
    current_instructor: Instructor = Depends(get_current_instructor),
) -> Instructor:
    """
    現在のアクティブな講師を取得する依存性注入関数

    Args:
        current_instructor: 現在の講師オブジェクト

    Returns:
        Instructor: アクティブな講師オブジェクト

    Raises:
        HTTPException: 講師が非アクティブな場合
    """
    if not current_instructor.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive instructor"
        )
    return current_instructor
