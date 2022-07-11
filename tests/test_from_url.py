import os

from flask import request
import pytest
import requests_mock


@pytest.fixture
def m():
    urls = [
        (
            r"sample-data/ExampleTrust-grants-fixed.json",
            "https://grantnav.threesixtygiving.org/grants/grants.json",
            "application/json",
        ),
        (
            r"sample-data/ExampleTrust-grants-fixed.csv",
            "https://grantnav.threesixtygiving.org/grants/grants.csv",
            "text/csv",
        ),
        (
            r"sample-data/ExampleTrust-grants-broken.csv",
            "https://grantnav.threesixtygiving.org/grants/broken-grants.csv",
            "text/csv",
        ),
        (
            r"sample-data/360-giving-package-schema.json",
            "https://raw.githubusercontent.com/ThreeSixtyGiving/standard/master/schema/360-giving-package-schema.json",
            "application/json",
        ),
        (
            r"sample-data/360-giving-schema.json",
            "https://raw.githubusercontent.com/ThreeSixtyGiving/standard/master/schema/360-giving-schema.json",
            "application/json",
        ),
    ]

    m = requests_mock.Mocker()
    thisdir = os.path.dirname(os.path.realpath(__file__))
    for i in urls:
        with open(os.path.join(thisdir, i[0]), "rb") as f_:
            m.get(i[1], content=f_.read(), headers={"Content-Type": i[2]})
            m.head(i[1], headers={"Content-Type": i[2]})

    m.start()
    return m


@pytest.mark.parametrize(
    "url",
    [
        "https://grantnav.threesixtygiving.org/grants/grants.json",
        "https://grantnav.threesixtygiving.org/grants/grants.csv",
    ],
)
def test_fetch_from_url(m, client, url):
    rv = client.get("/?url=" + url, follow_redirects=True)
    assert rv.status_code == 200
    assert "/data/" in request.path
    assert b"Uploaded dataset" in rv.data
    assert b"Could not fetch from URL" not in rv.data


@pytest.mark.parametrize(
    "url",
    [
        "https://raw.githubusercontent.com/ThreeSixtyGiving/standard/master/schema/360-giving-package-schema.json",
    ],
)
def test_fetch_from_url_broken(m, client, url):
    rv = client.get("/?url=" + url, follow_redirects=True)
    assert rv.status_code == 200
    assert request.path == "/"
    assert b"Could not fetch from URL" in rv.data
