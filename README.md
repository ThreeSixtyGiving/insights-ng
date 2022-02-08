Insights
========

[![Coverage Status](https://coveralls.io/repos/github/ThreeSixtyGiving/insights-ng/badge.svg)](https://coveralls.io/github/ThreeSixtyGiving/insights-ng)

## Installation

### Local

```
python3 -m venv .ve
source .ve/bin/activate

pip install -r requirements.txt
pip install -r dev-requirements.txt # if developing

Install postgres (Insights is tested in postgres 12)
sudo -u postgres createuser -P -e <username>  --interactive
createdb -U <username> -W insights-ng

export DATABASE_URL=postgresql://<username>:<password>@localhost/insights-ng
export MAPBOX_STYLE=<mapbox style uri>
export UPLOADS_FOLDER=/app/uploads
export DATASTORE_URL=postgresql://<datastore_user>:<datastore_password>@store.data.threesixtygiving.org:5432/360givingdatastore
export MAPBOX_ACCESS_TOKEN=<mapbox_access_token>
export FLASK_APP=insights.wsgi:app
export FLASK_ENV=development # if developing

```

Run [Migrations](#migrations)


### Dokku

```
dokku plugin:install https://github.com/dokku/dokku-postgres.git postgres

dokku apps:create insights-ng

dokku postgres:create insightsng_db
dokku postgres:link insightsng_db insights-ng

dokku config:set insights-ng FLASK_APP=insights.wsgi:app
dokku config:set insights-ng DATASTORE_URL=postgresql://user:pass@store.data.threesixtygiving.org:5432/360givingdatastore

# Import data from 360Giving datastore
dokku run insights-ng flask data fetch
dokku run insights-ng flask data geonames

```

## Migrations

```
flask db migrate
flask db upgrade
```

## Fetch data

```
flask data fetch
flask data geonames
```

## Update requirements

We target python3.6 for our requirements.

Use `pip-compile` provided by `pip-tools` package to process requirements .in files.

```
pip install pip-tools
pip-compile requirements.in 
pip-compile dev-requirements.in 
```

## Run

### Development server

```
export FLASK_APP=insights.wsgi:app
export FLASK_ENV=development
flask run
```

### Tests

```
pytest tests
```

### Test coverage

```
coverage run -m pytest ./tests
coverage report
```

### Linter

```
black insights/
```

## Design System

Insights' design system is located in [360-ds](https://github.com/ThreeSixtyGiving/360-ds). Any change in CSS needs to
be made in [Insights' folder](https://github.com/ThreeSixtyGiving/360-ds/tree/master/src/project-styles/insights) and
then compile.

```
cd 360-ds
npm run compile-sass -- --project 'insights' --path '../insights/static/css/'
```
