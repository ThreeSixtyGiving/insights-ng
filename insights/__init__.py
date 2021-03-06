import os
import random
import string
import sys
from urllib.parse import parse_qs

from flask import (
    Flask,
    abort,
    render_template,
    url_for,
    request,
    redirect,
    flash,
    Response,
)
from flask_graphql import GraphQLView
from flask_caching import Cache
import hashlib

from insights import settings
from insights.commands import fetch_data, expire, cache as cli_cache
from insights.data import get_frontpage_options, get_funder_names
from insights.db import GeoName, Publisher, Grant, db, migrate
from insights.schema import schema
from insights.utils import list_to_string
from insights.file_upload import upload_file, fetch_file_from_grantnav_url

__version__ = "0.1.0"


def create_app():
    def secret_key():
        if os.environ.get("SECRET_KEY"):
            return os.environ.get("SECRET_KEY")

        print(
            "Warning: Using self generated random key. Set environment var SECRET_KEY",
            file=sys.stderr,
        )
        return "".join(random.choice(string.ascii_lowercase) for i in range(40))

    database_url = os.environ.get("DATABASE_URL", "")

    # dokku uses postgres:// and sqlalchamy requires postgresql:// fix the url here
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://")

    app = Flask(__name__)
    app.config.from_mapping(
        DATASTORE_URL=os.environ.get("DATASTORE_URL"),
        SQLALCHEMY_DATABASE_URI=database_url,
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        MAPBOX_ACCESS_TOKEN=os.environ.get("MAPBOX_ACCESS_TOKEN"),
        URL_FETCH_ALLOW_LIST=settings.URL_FETCH_ALLOW_LIST,
        DATASET_EXPIRY_DAYS=settings.DATASET_EXPIRY_DAYS,
        SECRET_KEY=secret_key(),
        # https://flask-caching.readthedocs.io/en/latest/index.html#built-in-cache-backends
        CACHE_TYPE=os.environ.get("CACHE_TYPE", "FileSystemCache"),
        CACHE_DIR=os.environ.get("CACHE_DIR", "/tmp/insights-cac"),
        CACHE_DEFAULT_TIMEOUT=os.environ.get("CACHE_TIMEOUT", 0),
    )

    # Make sure that the tojson filter function does *not* use the jinja default of sorting the
    # keys. This is especially important as the key order needs to be maintained
    # for graph labels. (bin_labels)
    app.jinja_env.policies["json.dumps_kwargs"] = {"sort_keys": False}

    db.init_app(app)
    migrate.init_app(app, db)
    cache = Cache(app)

    app.cli.add_command(fetch_data.cli)
    app.cli.add_command(expire.cli)
    app.cli.add_command(cli_cache.cli)

    class CachedGraphQLView(GraphQLView):
        def dispatch_request(self, *args, **kwargs):

            body = self.parse_body()

            try:
                data = "%s%s" % (body["query"], body["variables"])
                cache_key = hashlib.md5(data.encode()).hexdigest()
                cached_result = cache.get(cache_key)
                if cached_result:
                    print("Cache hit")
                    return Response(
                        cached_result, status=200, content_type="application/json"
                    )
            except KeyError:
                cache_key = None

            response = GraphQLView.dispatch_request(self, *args, **kwargs)

            if cache_key:
                cache.set(cache_key, response.data)

            return response

    app.add_url_rule(
        "/graphql",
        view_func=CachedGraphQLView.as_view(
            "graphql",
            schema=schema,
            graphiql=False,  # for having the GraphiQL interface
        ),
    )

    @app.context_processor
    def inject_nav():
        return dict(
            nav={
                "360Insights": url_for("index"),
                "About": url_for("about"),
                "GrantNav": "https://grantnav.threesixtygiving.org/",
            }
        )

    @app.route("/")
    def index():
        # Loading data from GrantNav avoid the cache mechanism
        if request.args.get("url"):
            try:
                return redirect(fetch_file_from_grantnav_url(request.args.get("url")))
            except Exception as e:
                flash("Could not fetch from URL:" + repr(e), "error")
                return render_template(
                    "homepage.vue.j2", dataset_select=get_frontpage_options()
                )
        else:
            home_page_data = cache.get("home_page_data")
            if home_page_data:
                print("Cache hit")
                return render_template("homepage.vue.j2", dataset_select=home_page_data)
            else:
                home_page_data = get_frontpage_options()
                cache.set("home_page_data", home_page_data)

                return render_template("homepage.vue.j2", dataset_select=home_page_data)

    @app.route("/about")
    def about():
        return render_template("about.html.j2")

    def data_template(
        filters,
        dataset=settings.DEFAULT_DATASET,
        title="Granty grants",
        subtitle="Grants made by",
        template="data-display.vue.j2",
        **kwargs
    ):
        def bins_to_dict(labels, amounts):
            ret = {}
            for i, label in enumerate(labels):
                ret[label] = [amounts[i], amounts[i + 1]]

            return ret

        return render_template(
            template,
            dataset=dataset,
            base_filters=filters,
            bin_labels={
                "byAmountAwarded": bins_to_dict(
                    settings.AMOUNT_BIN_LABELS, settings.AMOUNT_BINS
                ),
                "byOrgAge": bins_to_dict(settings.AGE_BIN_LABELS, settings.AGE_BINS),
                "byOrgSize": bins_to_dict(
                    settings.INCOME_BIN_LABELS, settings.INCOME_BINS
                ),
            },
            title=title,
            subtitle=subtitle,
            **kwargs,
        )

    @app.route("/data")
    @app.route("/data/<dataset>")
    @app.route("/data/<dataset>/<page>")
    @app.route("/<data_type>/")
    @app.route("/<data_type>/<page>")
    @app.route("/<data_type>/<data_id>")
    @app.route("/<data_type>/<data_id>/<page>")
    def data(
        data_type="data", page="data", dataset=settings.DEFAULT_DATASET, data_id=None
    ):

        # Optimisation - Most of this is now redundant

        # regions are areas
        # local_authorities are areas
        if data_type == "regions" or data_type == "local_authorities":
            data_type = "areas"

        # flask has this in request.args but it is in a silly format
        query = parse_qs(request.query_string.decode("utf-8"))

        if data_type not in (
            "data",
            "funder",
            "funders",
            "funder_type",
            "funder_types",
            "publisher",
            "publishers",
            "file",
            "files",
            "area",
            "areas",
        ):
            abort(404, "Page not found")
        if page not in ("data", "map"):
            abort(404, "Page not found")

        filters = {}
        title = (
            "360Giving publishers"
            if dataset == settings.DEFAULT_DATASET
            else "Uploaded dataset"
        )
        subtitle = (
            "Grants made by" if dataset == settings.DEFAULT_DATASET else "Grants from"
        )
        if dataset != settings.DEFAULT_DATASET:
            page_urls = {
                "data": url_for("data", data_type=data_type, dataset=dataset),
                "map": url_for(
                    "data", data_type=data_type, page="map", dataset=dataset
                ),
            }
        else:
            page_urls = {
                "data": url_for("data", data_type=data_type, data_id=data_id),
                "map": url_for(
                    "data", data_type=data_type, page="map", data_id=data_id
                ),
            }

        if data_type == "funder" or data_type == "funders":
            if data_type == "funders":
                # multi select query
                funders = query.get("selected", ["none"])
            else:
                funders = [data_id]

            all_funder_names = get_funder_names(settings.DEFAULT_DATASET)
            funder_names = [
                all_funder_names[f] for f in funders if f in all_funder_names
            ]
            if len(funder_names) != len(funders):
                abort(404, description="Funder not found")
            filters["funders"] = funders
            title = (
                list_to_string(funder_names)
                if len(funder_names) < 8
                else "{:,.0f} funders".format(len(funder_names))
            )

        elif data_type == "funder_type" or data_type == "funder_types":
            if data_type == "funder_types":
                # multi select query
                funder_types = query.get("selected", ["none"])
            else:
                funder_types = [data_id]

            filters["funderTypes"] = funder_types
            title = list_to_string(funder_types)

        elif data_type == "publisher" or data_type == "publishers":
            if data_type == "publishers":
                # multi select query
                publishers = query.get("selected", ["none"])
            else:
                publishers = [data_id]

            publisher_names = []
            for p in publishers:
                publisher = db.session.query(Publisher).filter_by(prefix=p).first()
                if not publisher:
                    abort(404, "Publisher {} not found".format(p))
                publisher_names.append(publisher.name)
            filters["publishers"] = publishers
            title = list_to_string(publisher_names)
            subtitle = "Grants published by"

        elif data_type == "file":
            # Not currently in use?
            filters["files"] = data_id.split("+")

        elif data_type == "area" or data_type == "areas":
            if data_type == "areas":
                # multi select query
                areas = query.get("selected", ["none"])
            else:
                areas = [data_id]

            area_names = []
            for a in areas:
                area = db.session.query(GeoName).filter_by(id=a).first()
                if not area:
                    abort(404, "Area {} not found".format(a))
                area_names.append(area.name)
            filters["area"] = areas
            title = list_to_string(area_names)
            subtitle = "Grants made in"

        if page == "map":
            template = "map.data-display.vue.j2"
        else:
            template = "data-display.vue.j2"

        return data_template(
            filters,
            dataset=dataset,
            title=title,
            subtitle=subtitle,
            template=template,
            page_urls=page_urls,
        )

    # Handle legacy links from previous versions of Insights
    @app.route("/file/<file_id>")
    def file(file_id):
        funding_orgs = (
            db.session.query(Grant.fundingOrganization_id.distinct())
            .filter_by(source_file_id=file_id)
            .all()
        )

        if not funding_orgs:
            return redirect("/")

        get_query = "?"
        for funder in funding_orgs:
            get_query = "%s&funders=%s" % (get_query, funder[0])

        return redirect("/data" + get_query)

    # Upload functionality disabled for now
    # app.add_url_rule("/upload", "upload", view_func=upload_file, methods=["POST"])

    return app
