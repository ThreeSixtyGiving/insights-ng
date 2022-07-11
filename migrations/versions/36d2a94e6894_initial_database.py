"""initial database

Revision ID: 36d2a94e6894
Revises: 
Create Date: 2020-11-05 23:39:32.360608

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "36d2a94e6894"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "publisher",
        sa.Column("prefix", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("website", sa.String(length=255), nullable=True),
        sa.Column("logo", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("prefix"),
    )
    op.create_index(op.f("ix_publisher_logo"), "publisher", ["logo"], unique=False)
    op.create_index(op.f("ix_publisher_name"), "publisher", ["name"], unique=False)
    op.create_index(
        op.f("ix_publisher_website"), "publisher", ["website"], unique=False
    )
    op.create_table(
        "source_file",
        sa.Column("id", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("issued", sa.Date(), nullable=True),
        sa.Column("modified", sa.DateTime(), nullable=True),
        sa.Column("license", sa.String(length=255), nullable=True),
        sa.Column("license_name", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("publisher_prefix", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(
            ["publisher_prefix"],
            ["publisher.prefix"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_source_file_license"), "source_file", ["license"], unique=False
    )
    op.create_index(
        op.f("ix_source_file_license_name"),
        "source_file",
        ["license_name"],
        unique=False,
    )
    op.create_index(
        op.f("ix_source_file_title"), "source_file", ["title"], unique=False
    )
    op.create_table(
        "distribution",
        sa.Column("id", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("accessURL", sa.String(length=255), nullable=True),
        sa.Column("downloadURL", sa.String(length=255), nullable=True),
        sa.Column("source_file_id", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(
            ["source_file_id"],
            ["source_file.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_distribution_accessURL"), "distribution", ["accessURL"], unique=False
    )
    op.create_index(
        op.f("ix_distribution_downloadURL"),
        "distribution",
        ["downloadURL"],
        unique=False,
    )
    op.create_index(
        op.f("ix_distribution_title"), "distribution", ["title"], unique=False
    )
    op.create_table(
        "grant",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("dataset", sa.String(length=255), nullable=False),
        sa.Column("grant_id", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=1000), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("amountAwarded", sa.Integer(), nullable=False),
        sa.Column("awardDate", sa.Date(), nullable=False),
        sa.Column("plannedDates_startDate", sa.Date(), nullable=True),
        sa.Column("plannedDates_endDate", sa.Date(), nullable=True),
        sa.Column("plannedDates_duration", sa.Integer(), nullable=True),
        sa.Column("recipientOrganization_id", sa.String(length=255), nullable=False),
        sa.Column("recipientOrganization_name", sa.String(length=1000), nullable=False),
        sa.Column(
            "recipientOrganization_charityNumber", sa.String(length=255), nullable=True
        ),
        sa.Column(
            "recipientOrganization_companyNumber", sa.String(length=255), nullable=True
        ),
        sa.Column(
            "recipientOrganization_postalCode", sa.String(length=255), nullable=True
        ),
        sa.Column("fundingOrganization_id", sa.String(length=255), nullable=False),
        sa.Column("fundingOrganization_name", sa.String(length=255), nullable=False),
        sa.Column(
            "fundingOrganization_department", sa.String(length=255), nullable=True
        ),
        sa.Column("grantProgramme_title", sa.String(length=255), nullable=True),
        sa.Column("source_file_id", sa.String(length=255), nullable=True),
        sa.Column("publisher_id", sa.String(length=255), nullable=True),
        sa.Column("insights_geo_region", sa.String(length=255), nullable=True),
        sa.Column("insights_geo_la", sa.String(length=255), nullable=True),
        sa.Column("insights_geo_country", sa.String(length=255), nullable=True),
        sa.Column("insights_geo_lat", sa.Float(), nullable=True),
        sa.Column("insights_geo_long", sa.Float(), nullable=True),
        sa.Column("insights_geo_source", sa.String(length=255), nullable=True),
        sa.Column("insights_org_id", sa.String(length=255), nullable=True),
        sa.Column("insights_org_registered_date", sa.Date(), nullable=True),
        sa.Column("insights_org_latest_income", sa.Integer(), nullable=True),
        sa.Column("insights_org_type", sa.String(length=255), nullable=True),
        sa.Column("insights_band_age", sa.String(length=255), nullable=True),
        sa.Column("insights_band_income", sa.String(length=255), nullable=True),
        sa.Column("insights_band_amount", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(
            ["publisher_id"],
            ["publisher.prefix"],
        ),
        sa.ForeignKeyConstraint(
            ["source_file_id"],
            ["source_file.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_grant_amountAwarded"), "grant", ["amountAwarded"], unique=False
    )
    op.create_index(op.f("ix_grant_awardDate"), "grant", ["awardDate"], unique=False)
    op.create_index(op.f("ix_grant_currency"), "grant", ["currency"], unique=False)
    op.create_index(op.f("ix_grant_dataset"), "grant", ["dataset"], unique=False)
    op.create_index(
        op.f("ix_grant_fundingOrganization_id"),
        "grant",
        ["fundingOrganization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_grant_grantProgramme_title"),
        "grant",
        ["grantProgramme_title"],
        unique=False,
    )
    op.create_index(
        op.f("ix_grant_insights_band_age"), "grant", ["insights_band_age"], unique=False
    )
    op.create_index(
        op.f("ix_grant_insights_band_amount"),
        "grant",
        ["insights_band_amount"],
        unique=False,
    )
    op.create_index(
        op.f("ix_grant_insights_band_income"),
        "grant",
        ["insights_band_income"],
        unique=False,
    )
    op.create_index(
        op.f("ix_grant_insights_geo_country"),
        "grant",
        ["insights_geo_country"],
        unique=False,
    )
    op.create_index(
        op.f("ix_grant_insights_geo_region"),
        "grant",
        ["insights_geo_region"],
        unique=False,
    )
    op.create_index(
        op.f("ix_grant_insights_org_type"), "grant", ["insights_org_type"], unique=False
    )
    op.create_index(
        op.f("ix_grant_publisher_id"), "grant", ["publisher_id"], unique=False
    )
    op.create_index(
        op.f("ix_grant_recipientOrganization_id"),
        "grant",
        ["recipientOrganization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_grant_source_file_id"), "grant", ["source_file_id"], unique=False
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f("ix_grant_source_file_id"), table_name="grant")
    op.drop_index(op.f("ix_grant_recipientOrganization_id"), table_name="grant")
    op.drop_index(op.f("ix_grant_publisher_id"), table_name="grant")
    op.drop_index(op.f("ix_grant_insights_org_type"), table_name="grant")
    op.drop_index(op.f("ix_grant_insights_geo_region"), table_name="grant")
    op.drop_index(op.f("ix_grant_insights_geo_country"), table_name="grant")
    op.drop_index(op.f("ix_grant_insights_band_income"), table_name="grant")
    op.drop_index(op.f("ix_grant_insights_band_amount"), table_name="grant")
    op.drop_index(op.f("ix_grant_insights_band_age"), table_name="grant")
    op.drop_index(op.f("ix_grant_grantProgramme_title"), table_name="grant")
    op.drop_index(op.f("ix_grant_fundingOrganization_id"), table_name="grant")
    op.drop_index(op.f("ix_grant_dataset"), table_name="grant")
    op.drop_index(op.f("ix_grant_currency"), table_name="grant")
    op.drop_index(op.f("ix_grant_awardDate"), table_name="grant")
    op.drop_index(op.f("ix_grant_amountAwarded"), table_name="grant")
    op.drop_table("grant")
    op.drop_index(op.f("ix_distribution_title"), table_name="distribution")
    op.drop_index(op.f("ix_distribution_downloadURL"), table_name="distribution")
    op.drop_index(op.f("ix_distribution_accessURL"), table_name="distribution")
    op.drop_table("distribution")
    op.drop_index(op.f("ix_source_file_title"), table_name="source_file")
    op.drop_index(op.f("ix_source_file_license_name"), table_name="source_file")
    op.drop_index(op.f("ix_source_file_license"), table_name="source_file")
    op.drop_table("source_file")
    op.drop_index(op.f("ix_publisher_website"), table_name="publisher")
    op.drop_index(op.f("ix_publisher_name"), table_name="publisher")
    op.drop_index(op.f("ix_publisher_logo"), table_name="publisher")
    op.drop_table("publisher")
    # ### end Alembic commands ###
