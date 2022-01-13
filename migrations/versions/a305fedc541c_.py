"""empty message

Revision ID: a305fedc541c
Revises: 320bf2022418
Create Date: 2022-01-11 12:03:41.710644

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a305fedc541c'
down_revision = '320bf2022418'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('org_id_ids',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('org_id', sa.String(length=255), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_org_id_ids_org_id'), 'org_id_ids', ['org_id'], unique=False)
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_org_id_ids_org_id'), table_name='org_id_ids')
    op.drop_table('org_id_ids')
    # ### end Alembic commands ###