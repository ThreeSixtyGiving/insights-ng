
## Dokku installation

```
dokku plugin:install https://github.com/dokku/dokku-postgres.git postgres

dokku apps:create insights-ng

dokku postgres:create insightsng_db
dokku postgres:link insightsng_db insights-ng

dokku config:set insights-ng FLASK_APP=insights.wsgi:app
dokku config:set insights-ng DATASTORE_URL=postgresql://user:pass@store.data.threesixtygiving.org:5432/360givingdatastore

# Import data from 360Giving datastore
dokku run insights-ng flask data fetch

```

## Migrations

```
flask db migrate
flask db upgrade
```

## Tests

```
pytest tests
```

## Test coverage

```
coverage run -m pytest ./tests
coverage report
```