"""Projects REST endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import AuthenticatedUser, get_current_user
from app.repos.database import user_transaction
from app.repos.projects import create_project, delete_project, get_project, list_projects
from app.schemas.api import ProjectCreate, ProjectResponse

router = APIRouter(prefix="/projects", tags=["Projects"])

CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create(payload: ProjectCreate, user: CurrentUser) -> dict[str, object]:
    async with user_transaction(user) as conn:
        project = await create_project(
            conn,
            owner_id=str(user.user_id),
            name=payload.name,
        )
        return project


@router.get("", response_model=list[ProjectResponse])
async def list_all(user: CurrentUser) -> list[dict[str, object]]:
    async with user_transaction(user) as conn:
        projects = await list_projects(conn, owner_id=str(user.user_id))
        return projects


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_one(project_id: str, user: CurrentUser) -> dict[str, object]:
    async with user_transaction(user) as conn:
        project = await get_project(conn, project_id=project_id, owner_id=str(user.user_id))
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )
        return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(project_id: str, user: CurrentUser) -> None:
    async with user_transaction(user) as conn:
        deleted = await delete_project(conn, project_id=project_id, owner_id=str(user.user_id))
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found or already deleted",
            )
