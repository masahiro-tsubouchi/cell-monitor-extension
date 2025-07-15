from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List


class CellMonitor(BaseModel):
    """
    Jupyter Cell Monitoring Schema
    
    Stores information about cell execution, including content, outputs, and metadata
    """
    userId: Optional[str] = None
    notebookPath: Optional[str] = None
    cellId: Optional[str] = None
    cellIndex: Optional[int] = None
    cellType: Optional[str] = None  # 'code', 'markdown', etc.
    cellContent: Optional[str] = None
    outputs: Optional[List[Dict[str, Any]]] = None
    executionCount: Optional[int] = None
    executionTime: Optional[float] = None
    executionStatus: Optional[str] = None  # 'success', 'error', etc.
    timestamp: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
