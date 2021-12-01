import os

import chromedriver_autoinstaller
import pytest
from flask import url_for
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

os.environ['FLASK_ENV'] = 'development'
BROWSER = os.environ.get('BROWSER', 'ChromeHeadless')

# Ensure the correct version of chromedriver is installed
chromedriver_autoinstaller.install()

@pytest.fixture(scope="module")
def browser(request):
    if BROWSER == 'ChromeHeadless':
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        browser = webdriver.Chrome(options=chrome_options)
    else:
        browser = getattr(webdriver, BROWSER)()
    browser.implicitly_wait(3)
    request.addfinalizer(lambda: browser.quit())
    return browser


@pytest.mark.usefixtures('live_server')
def test_home(browser):
    browser.get(url_for('index', _external=True))

    assert 'Insights' in browser.find_element_by_tag_name('body').text
