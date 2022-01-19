import datetime

from flask.cli import AppGroup
from insights.db import db, SourceFile, Grant
from insights import settings


cli = AppGroup("expire")


@cli.command("uploaded_data")
def expire_uploaded_data():
    expiry_datetime = datetime.datetime.now() - datetime.timedelta(
        days=settings.DATASET_EXPIRY_DAYS
    )

    for source_file in SourceFile.query.filter(
        SourceFile.publisher_prefix == None
    ).filter(SourceFile.modified < expiry_datetime):
        Grant.query.filter(Grant.source_file == source_file).filter(
            Grant.dataset != "main"
        ).delete()
        db.session.delete(source_file)
        db.session.commit()
