import datetime

from insights.db import db, SourceFile, Grant
from insights import settings
from .test_insights import test_app, create_testdata_grants


def test_expire(test_app):
    runner = test_app.test_cli_runner()

    # Absolute datetime more than expiry cut off in the past
    create_testdata_grants(
        source_file_id="uploaded_dataset_d7d3a2e80e3c85c53403f34c3058b010",
        source_file_modified=datetime.datetime(2020, 1, 1),
        publisher_prefix=None,
        grant_dataset="d7d3a2e80e3c85c53403f34c3058b010",
    )
    # Abosloute datetime well in the future
    create_testdata_grants(
        source_file_id="uploaded_dataset_d7d3a2e80e3c85c53403f34c3058b011",
        source_file_modified=datetime.datetime(2220, 1, 1),
        publisher_prefix=None,
        grant_dataset="d7d3a2e80e3c85c53403f34c3058b011",
    )
    # No datetime specified, should default to now
    create_testdata_grants(
        source_file_id="uploaded_dataset_d7d3a2e80e3c85c53403f34c3058b012",
        publisher_prefix=None,
        grant_dataset="d7d3a2e80e3c85c53403f34c3058b012",
    )
    # Calculate a datetime before expiry point
    create_testdata_grants(
        source_file_id="uploaded_dataset_d7d3a2e80e3c85c53403f34c3058b013",
        source_file_modified=datetime.datetime.now()
        - datetime.timedelta(days=settings.DATASET_EXPIRY_DAYS * 2),
        publisher_prefix=None,
        grant_dataset="d7d3a2e80e3c85c53403f34c3058b013",
    )
    # Calculate a datetime after expiry point
    create_testdata_grants(
        source_file_id="uploaded_dataset_d7d3a2e80e3c85c53403f34c3058b014",
        source_file_modified=datetime.datetime.now()
        - datetime.timedelta(days=settings.DATASET_EXPIRY_DAYS / 2),
        publisher_prefix=None,
        grant_dataset="d7d3a2e80e3c85c53403f34c3058b014",
    )
    # Check that grants with the default dataset (main) are not deleted
    main_grants_ids = create_testdata_grants(
        source_file_id="uploaded_dataset_d7d3a2e80e3c85c53403f34c3058b015",
        source_file_modified=datetime.datetime(2020, 1, 1),
        publisher_prefix=None,
    )

    result = runner.invoke(args=["expire", "uploaded_data"])

    assert [s.id for s in SourceFile.query.all()] == [
        "12345",
        "uploaded_dataset_d7d3a2e80e3c85c53403f34c3058b011",
        "uploaded_dataset_d7d3a2e80e3c85c53403f34c3058b012",
        "uploaded_dataset_d7d3a2e80e3c85c53403f34c3058b014",
    ]

    assert set(g.source_file_id for g in Grant.query.all()) == set(
        [
            "12345",
            "uploaded_dataset_d7d3a2e80e3c85c53403f34c3058b011",
            "uploaded_dataset_d7d3a2e80e3c85c53403f34c3058b012",
            "uploaded_dataset_d7d3a2e80e3c85c53403f34c3058b014",
            None,
        ]
    )

    assert set(g.dataset for g in Grant.query.all()) == set(
        [
            "main",
            "d7d3a2e80e3c85c53403f34c3058b011",
            "d7d3a2e80e3c85c53403f34c3058b012",
            "d7d3a2e80e3c85c53403f34c3058b014",
        ]
    )

    assert set(main_grants_ids) <= set(g.id for g in Grant.query.all())
