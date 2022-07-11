"""empty message

Revision ID: 634128ac4f8f
Revises: b6048c860b2e
Create Date: 2022-04-04 16:26:22.924198

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "634128ac4f8f"
down_revision = "b6048c860b2e"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column(
        "grant",
        "amountAwarded",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_nullable=False,
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column(
        "grant",
        "amountAwarded",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_nullable=False,
    )
    # ### end Alembic commands ###
