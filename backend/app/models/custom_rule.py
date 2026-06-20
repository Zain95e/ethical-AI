import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import String, DateTime, Text, Float, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.project import Project


class CustomRule(Base):
    __tablename__ = "custom_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    principle: Mapped[str] = mapped_column(String(50), nullable=False, default="fairness")
    base_metric: Mapped[str] = mapped_column(String(100), nullable=False)
    aggregation: Mapped[str] = mapped_column(String(50), nullable=False)
    comparison: Mapped[str] = mapped_column(String(10), nullable=False, default=">=")
    default_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=0.8)
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    created_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by_id])

    def __repr__(self) -> str:
        return f"<CustomRule(id={self.id}, name={self.name}, principle={self.principle})>"
