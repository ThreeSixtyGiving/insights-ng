import datetime
import os
import tempfile

import pytest

from insights import __version__, create_app
from insights.db import Grant, Publisher, SourceFile, db


def test_version():
    assert __version__ == "0.1.0"


@pytest.fixture
def test_app():
    app = create_app()
    db_fd, db_path = tempfile.mkstemp()
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///{}".format(db_path)
    app.config["TESTING"] = True

    with app.app_context():
        db.create_all()
        create_testdata_grants()
        yield app

    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture
def client():
    app = create_app()
    db_fd, db_path = tempfile.mkstemp()
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///{}".format(db_path)
    app.config["TESTING"] = True

    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            create_testdata_grants()
        yield client

    os.close(db_fd)
    os.unlink(db_path)


def create_testdata_grants(
    source_file_id="12345",
    publisher_prefix="360G-pub",
    source_file_modified=None,
    grant_dataset="main",
):
    if publisher_prefix is None:
        publisher = None
    else:
        publisher = Publisher(prefix=publisher_prefix, name="Publisher")
        db.session.merge(publisher)
    source_file = SourceFile(
        id=source_file_id,
        title="Source file",
        publisher=publisher,
    )
    if source_file_modified:
        source_file.modified = source_file_modified
    db.session.merge(source_file)
    grant_ids = []
    for i in range(0, 10):
        g = Grant(
            dataset=grant_dataset,
            grant_id=f"testdata_{i}",
            title=f"Testdata Grant {i}",
            description="A testdata grant",
            currency="GBP",
            amountAwarded=100 * (i + 1),
            awardDate=datetime.date(2020, (i % 12) + 1, (i % 28) + 1),
            recipientOrganization_id=f"360G-testdata-{i}",
            recipientOrganization_name=f"Testdata Recipient {i}",
            fundingOrganization_id=f"360G-testdata-funder-{i % 3}",
            fundingOrganization_name=f"Testdata Funder {i % 3}",
            publisher=publisher,
            source_file=source_file,
        )
        g_merged = db.session.merge(g)
        db.session.commit()
        grant_ids.append(g_merged.id)
    return grant_ids


def test_index(client):
    rv = client.get("/")
    assert rv.status_code == 200
    assert b"See your grantmaking in new ways" in rv.data
    assert b"Testdata Funder 0" in rv.data
    assert b"https://grantnav.threesixtygiving.org/" in rv.data


def test_about(client):
    rv = client.get("/about")
    assert rv.status_code == 200
    assert b"About 360Insights" in rv.data


def test_funder_dash(client):
    rv = client.get("/funder/360G-testdata-funder-0")
    assert rv.status_code == 200
    assert b"360G-testdata-funder-0" in rv.data


def test_funder_dash_404(client):
    rv = client.get("/funder/360G-testdata-funder-not-found")
    assert rv.status_code == 404


def test_publisher_dash(client):
    rv = client.get("/publisher/360G-pub")
    assert rv.status_code == 200
    assert b"360G-pub" in rv.data


def test_publisher_dash_404(client):
    rv = client.get("/publisher/360G-testdata-pub-not-found")
    assert rv.status_code == 404
