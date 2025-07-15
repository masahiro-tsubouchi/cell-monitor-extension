from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class StudentProgress(BaseModel):
    userId: Optional[str] = None
    notebookPath: Optional[str] = None
    event: Optional[str] = None
    cellId: Optional[str] = None
    cellIndex: Optional[int] = None
    cellContent: Optional[str] = None
    executionCount: Optional[int] = None
    timestamp: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
