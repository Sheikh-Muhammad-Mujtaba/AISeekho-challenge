from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from core.security import get_current_user
from db.models import User, WorkflowRun
from db.session import get_db

router = APIRouter()

class WorkflowRunCreate(BaseModel):
    workflow_type: str
    mode: str = "simulation"

class WorkflowRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    mode: str
    workflow_type: str

@router.post("/", response_model=WorkflowRunResponse)
async def create_run(
    run_in: WorkflowRunCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Initialize a new workflow run.
    """
    db_run = WorkflowRun(
        user_id=current_user.id,
        workflow_type=run_in.workflow_type,
        mode=run_in.mode,
        status="running"
    )
    db.add(db_run)
    await db.commit()
    await db.refresh(db_run)
    return db_run

@router.get("/{run_id}", response_model=WorkflowRunResponse)
async def get_run(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the status of a specific workflow run.
    """
    result = await db.execute(
        select(WorkflowRun).where(WorkflowRun.id == run_id, WorkflowRun.user_id == current_user.id)
    )
    run = result.scalars().first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run
