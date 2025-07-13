from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from enum import Enum
import json
import logging
from datetime import datetime
import uuid

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Cell Monitor API")

# Enable CORS for JupyterLab
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development - restrict this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# イベントタイプの定義
class EventType(str, Enum):
    CELL_EXECUTED = "cell_executed"
    NOTEBOOK_OPENED = "notebook_opened"
    NOTEBOOK_SAVED = "notebook_saved"
    NOTEBOOK_CLOSED = "notebook_closed"

# セルタイプの定義
class CellType(str, Enum):
    CODE = "code"
    MARKDOWN = "markdown"
    RAW = "raw"

# 従来のCell Execution Dataモデル (後方互換性のため保持)
class CellExecution(BaseModel):
    cellId: str
    code: str
    executionTime: str
    result: str
    hasError: bool
    notebookPath: str

# 拡張データモデル - 学習進捗データ
class StudentProgressData(BaseModel):
    eventId: str
    eventType: EventType
    eventTime: str
    userId: str
    userName: str
    sessionId: str
    notebookPath: str
    cellId: Optional[str] = None
    cellIndex: Optional[int] = None
    cellType: Optional[CellType] = None
    code: Optional[str] = None
    executionCount: Optional[int] = None
    hasError: Optional[bool] = None
    errorMessage: Optional[str] = None
    result: Optional[str] = None
    executionDurationMs: Optional[int] = None

@app.get("/")
async def root():
    return {"message": "Welcome to Cell Monitor API"}

@app.post("/cell-monitor")
async def receive_cell_data(data: List[CellExecution]):
    try:
        # Log the received data
        logger.info(f"Received data for {len(data)} cells")
        
        for cell in data:
            # Format and log each cell execution
            execution_time = datetime.fromisoformat(cell.executionTime.replace('Z', '+00:00'))
            status = "ERROR" if cell.hasError else "SUCCESS"
            
            log_message = f"""
            =================================
            CELL EXECUTION: {status}
            =================================
            Notebook: {cell.notebookPath}
            Cell ID: {cell.cellId}
            Time: {execution_time}
            Code:
            ```
            {cell.code}
            ```
            Result: {cell.result[:100]}{"..." if len(cell.result) > 100 else ""}
            =================================
            """
            logger.info(log_message)
            
        return {"status": "success", "processed": len(data)}
    
    except Exception as e:
        logger.error(f"Error processing cell data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/student-progress")
async def receive_student_progress(data: List[StudentProgressData]):
    try:
        # Log the received data
        logger.info(f"Received student progress data: {len(data)} events")
        
        for event in data:
            # イベントタイプに応じたログメッセージを構築
            event_time = datetime.fromisoformat(event.eventTime.replace('Z', '+00:00'))
            
            # 基本情報のログを構築
            base_info = f"""
            =================================
            EVENT: {event.eventType.value}
            =================================
            User: {event.userName} (ID: {event.userId})
            Session: {event.sessionId}
            Time: {event_time}
            Notebook: {event.notebookPath}
            """
            
            # イベントタイプごとの追加情報
            if event.eventType == EventType.CELL_EXECUTED:
                status = "ERROR" if event.hasError else "SUCCESS"
                cell_info = f"""
                Cell ID: {event.cellId}
                Cell Index: {event.cellIndex if event.cellIndex is not None else 'N/A'}
                Cell Type: {event.cellType.value if event.cellType else 'N/A'}
                Execution Count: {event.executionCount if event.executionCount is not None else 'N/A'}
                Execution Duration: {event.executionDurationMs if event.executionDurationMs is not None else 'N/A'} ms
                Status: {status}
                Code:
                ```
                {event.code if event.code else 'N/A'}
                ```
                Result: {event.result[:100] if event.result else 'N/A'}{"..." if event.result and len(event.result) > 100 else ""}
                {f"Error: {event.errorMessage}" if event.hasError and event.errorMessage else ""}
                """
                log_message = base_info + cell_info
            elif event.eventType in [EventType.NOTEBOOK_OPENED, EventType.NOTEBOOK_SAVED, EventType.NOTEBOOK_CLOSED]:
                log_message = base_info + "\n"
            else:
                log_message = base_info + "\nUnknown event type\n"
            
            log_message += "=================================\n"
            logger.info(log_message)
            
        return {"status": "success", "processed": len(data)}
    
    except Exception as e:
        logger.error(f"Error processing student progress data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
