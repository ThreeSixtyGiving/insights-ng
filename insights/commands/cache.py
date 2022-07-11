from flask import current_app
from flask.cli import AppGroup

from insights.db import Publisher

from flask_caching import Cache
import os
import time
import click

try:
    import chromedriver_autoinstaller
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options

    cache_warmer_available = True
    # Ensure the correct version of chromedriver is installed
    chromedriver_autoinstaller.install()
except Exception:
    cache_warmer_available = False

BROWSER = os.environ.get("BROWSER", "ChromeHeadless")


cli = AppGroup("cache")


@cli.command("warm")
@click.option(
    "--url",
    default="http://localhost:5000",
    show_default=True,
    help="Url to the target server",
)
def warm_cache(url):
    if not cache_warmer_available:
        click.echo("Cache warmer not available please install dev dependencies")
        return

    if BROWSER == "ChromeHeadless":
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        browser = webdriver.Chrome(options=chrome_options)
    else:
        browser = getattr(webdriver, BROWSER)()

    browser.implicitly_wait(3)

    browser.get(url)

    for publisher in Publisher.query.filter():
        print("Fetching %s" % publisher.prefix)
        browser.get("%s/data?funders=%s" % (url, publisher.prefix))
        time.sleep(4)


@cli.command("clear")
@click.option(
    "--homepage",
    default=False,
    is_flag=True,
    show_default=True,
    help="Only clear homepage cache",
)
def clear_cache(homepage):
    with current_app.app_context():
        if homepage:
            Cache(current_app).delete("home_page")
        else:
            Cache(current_app).clear()
