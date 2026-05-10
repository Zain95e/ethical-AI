"""add updated_at to validation_presets

Revision ID: 1b2c3d4e5f6a
Revises: 0a1b2c3d4e5f
Create Date: 2026-05-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "1b2c3d4e5f6a"
down_revision: Union[str, None] = "0a1b2c3d4e5f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The original migration for validation_presets did not include updated_at,
    # but the SQLAlchemy model declares it.  Add it now so the ORM and DB agree.
    op.execute(
        """
        ALTER TABLE validation_presets
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        """
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE validation_presets DROP COLUMN IF EXISTS updated_at"
    )
