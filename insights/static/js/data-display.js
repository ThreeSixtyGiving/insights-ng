import { lineChart } from './components/line-chart.js';
import { barChart } from './components/bar-chart.js';
import { mapboxMap } from './components/map.js';
import { GQL, gqlSingleGraph, graphqlQuery } from './gql/query.js';
import { SOURCE_GQL } from './gql/sources.js';
import { GEO_GQL } from './gql/geo.js';
import { formatCurrency, formatDate, formatNumber, getAmountSuffix, formatNumberSuffix } from './components/filters.js';
import { debounce } from './lib/debounce.js';

const COLOURS = {
    yellow: "#EFC329",
    red: "#BC2C26",
    teal: "#4DACB6",
    orange: "#DE6E26",
}


Vue.component('bar-chart', barChart);
Vue.component('line-chart', lineChart);
Vue.component('mapbox-map', mapboxMap);
Vue.component('multi-select', window.VueMultiselect.default)

Vue.filter('formatCurrency', formatCurrency);
Vue.filter('formatDate', formatDate);
Vue.filter('formatNumber', formatNumber);
Vue.filter('getAmountSuffix', getAmountSuffix);
Vue.filter('formatNumberSuffix', formatNumberSuffix);


function funderIdsToFunderObject(funderIds){
    /* Takes an array of funderIds (str) and outputs an
      array of funder objects */
    let funders = [];

    var allFunderIds = DATASET_SELECT.funders.map((funder) =>{
        return funder.value
    });

    funderIds.forEach((funderId) => {
        let funderIdx = allFunderIds.indexOf(funderId);
        if (funderIdx > -1){
            funders.push(DATASET_SELECT.funders[funderIdx]);
        }
    });

    return funders;
}

function initialFilters(useQueryParams) {
    var params = new URLSearchParams(window.location.search);

    if(!useQueryParams){
        params = new URLSearchParams();
    }
    return {
        awardAmount: {
            min: params.get("awardAmount.min"),
            max: params.get("awardAmount.max"),
        },
        awardDates: {
            min: params.get("awardDates.min"),
            max: params.get("awardDates.max"),
        },
        orgSize: {
            min: params.get("orgSize.min"),
            max: params.get("orgSize.max"),
        },
        orgAge: {
            min: params.get("orgAge.min"),
            max: params.get("orgAge.max"),
        },
        search: params.get("search") || '',
        area: params.getAll("area"),
        orgtype: params.getAll("orgtype"),
        grantProgrammes: params.getAll("grantProgrammes"),
        funders: funderIdsToFunderObject(params.getAll("funders")),
        funderTypes: params.getAll("funderTypes").map((fType) => (
            { id: fType, value: fType ,label: fType }
        )),
    }
}

var chartToFilters = {
    byGrantProgramme: 'grantProgrammes',
    byFunder: 'funders',
    byFunderType: 'funderTypes',
    byCountryRegion: 'area',
}

/* Same as above but k,v swapped */
var filtersToChart = Object.fromEntries(Object.entries(chartToFilters).map(([key,val]) => [val, key] ));

var app = new Vue({
    el: '#data-display',
    data() {
        return {
            dataset: DATASET,
            title: TITLE,
            subtitle: SUBTITLE,
            bin_labels: BIN_LABELS,
            loading: false,
            loadingQ: 0,
            initialData: null,
            chartData: {},
            inactiveChartData: {},
            summary: {
                grants: DATASET_SELECT.dataset_stats.grants_total,
                recipients: DATASET_SELECT.dataset_stats.recipients_total,
                currencies:[ {
                    currency: "GBP",
                    /* FIXME : grants_total includes non GBP */
                    grants: DATASET_SELECT.dataset_stats.grants_total,
                    total: DATASET_SELECT.dataset_stats.amount_total,
                    mean: DATASET_SELECT.dataset_stats.amount_average
                }],
            },
            default_currency: 'GBP',
            funders: [],
            base_filters: BASE_FILTERS,
            filters: initialFilters(true),
            source_ids: [],
            sources: [],
            showFilters: false,
            grants: [],
            mapUrl: PAGE_URLS['map'],
            dataUrl: PAGE_URLS['data'],
            datasetSelect: DATASET_SELECT,
            phase: "one",
            find: { funder: null, funderTypes: null },
        }
    },
    computed: {
        computedFilters() {
            /* Take a copy of the filters */
            var filters = JSON.parse(JSON.stringify(this.filters));

            /* convert the filter data into data for graphql query */
            ['awardAmount', 'awardDates', 'orgSize', 'orgAge'].forEach((field) => {
                if (filters[field].min === '') { filters[field].min = null; }
                if (filters[field].max === '') { filters[field].max = null; }
            });
            ['area', 'orgtype', 'grantProgrammes', 'funders', 'funderTypes'].forEach((field) => {
                filters[field] = filters[field].map((item) => typeof item=="string" ? item : item.value );
                if (Array.isArray(BASE_FILTERS[field])) {
                    filters[field] = filters[field].concat(BASE_FILTERS[field]);
                    filters[field] = [...new Set(filters[field])];
                }
            });
            return filters;
        },
      /* Not in use?
        funderList: function () {
            if (this.funders.length == 1) {
                return this.funders[0];
            }
            if (this.funders.length < 5) {
                return this.funders.slice(0, -1).join(', ') + " and " + this.funders.slice(-1);
            }
            if (this.funders.length > 0) {
                return `${formatNumber(this.funders.length)} funders`;
            }
            return 'No funders found'
        },*/
        funderListInit: function () {
            if (this.find.funder) {
                return this.datasetSelect.funders.filter((v) => {
                    let searchStr = v.name
                        .concat(" ", v.id)
                        .toLowerCase();
                    return searchStr.includes(this.find.funder.toLowerCase());
                });
            }
            return this.datasetSelect.funders;
        },
        funderTypeListInit: function () {
            if (this.find.funderTypes) {
                return this.datasetSelect.funder_types.filter((v) => {
                    let searchStr = v.name
                        .concat(" ", v.id)
                        .toLowerCase();
                    return searchStr.includes(this.find.funder_types.toLowerCase());
                });
            }
            return this.datasetSelect.funder_types;
        },
        currencyUsed: function () {
            var currencies = this.summary.currencies.map((c) => c.currency);
            if(currencies.length == 0){
                return this.default_currency;
            }
            if (currencies.includes(this.default_currency)) {
                return this.default_currency;
            }
            return currencies[0];
        },
        geoGrants: function () {
            var grants = this.grants.filter((g) => (g.insightsGeoLat != null && g.insightsGeoLong != null));
            if (grants.length == 0) { return null; }
            return grants;
        },
    },
    watch: {
        'loadingQ': function(){
            if (this.loadingQ > 0){
                this.loading = true;
            } else {
                this.loading= false;
            }
        },
     /*   'source_ids': function (val, oldVal) {
            if (val.toString() != oldVal.toString()) {
                graphqlQuery(SOURCE_GQL, { 'sources': this.source_ids })
                    .then((data) => { app.sources = data.data.sourceFiles });
            }
        },*/
        'filters': {
            handler: debounce(function () {
                this.updateUrl();

                if (window.location.search){
                /* We have a query in progress switch to phase two */
                  this.phase = "two";
                } else {
                  this.phase = "one";
                }

                this.updateData();
            }, 1000),
            deep: true,
            immediate: false,
        },
    },
    methods: {
        updateUrl() {
            var queryParams = new URLSearchParams();
            Object.entries(this.filters)
                .filter(([k, v]) => v && v.length != 0)
                .forEach(([k, v]) => {
                    if (Array.isArray(v)) {
                        v.filter((w) => w && w.length != 0)
                            .forEach((w, i) => {
                                if(typeof w == "string"){
                                    queryParams.append(k, w);
                                } else {
                                    queryParams.append(k, w.value);
                                }
                            })
                    } else if (typeof v === 'object' && v !== null) {
                        Object.entries(v)
                            .filter(([l, w]) => w && w.length != 0)
                            .forEach(([l, w]) => {
                                queryParams.append(`${k}.${l}`, w);
                            })
                    } else {
                        queryParams.append(k, v);
                    }
                });
            if(queryParams.toString()){
                this.mapUrl = PAGE_URLS['map'] + '?' + queryParams.toString();
                this.dataUrl = PAGE_URLS['data'] + '?' + queryParams.toString();
            } else {
                this.mapUrl = PAGE_URLS['map'];
                this.dataUrl = PAGE_URLS['data'];
            }
            history.pushState(this.filters, '', "?" + queryParams.toString());
        },
        resetFilters() {
            this.filters = initialFilters(false);
        },
        updateData() {
            /* If no search query params do nothing
            FIXME: Relying on this method is fragile as anything could be set on
            window.location.search, we need a way to know if certain filters are active or not
            */
            if (!window.location.search){
                return;
            }
            this.phase = "two";

            var app = this;
            app.loadingQ++;


            graphqlQuery(GQL, {
                dataset: app.dataset,
                ...app.base_filters,
                ...app.computedFilters,
            }).then((data) => {
                Object.entries(data.data.grantAggregates).forEach(([key, value]) => {
                    if (key == "summary") {
                        app.summary = value[0];
                    } else if (key == "bySource") {
                        app.source_ids = value.map((v) => v.bucketGroup[0].id);
                    } else {
                        app.chartData[key] = value;
                    }
                    if (key == "byFunder") {
                        app.funders = value.map((f) => f.bucketGroup[0].name);
                    }

                });

                /* depending on the filters set find out what the data options would have been */
                if (window.location.search){
                    ['funders', 'funderTypes', 'area', 'orgtype', 'grantProgrammes'].forEach((filter) => {
                        if ( app.filters[filter].length > 0){
                            this.dataWithoutFilter(filter);
                        }
                    });
                }

                app.loadingQ--;
            });
            graphqlQuery(GEO_GQL, {
                dataset: app.dataset,
                ...app.base_filters,
                ...app.computedFilters,
            }).then((data) => {
                app.grants = data.data.grants;
            });

        },
        dataWithoutFilter(filterName){
            console.log("Doing with out filter on "+filterName);
            /* returns the without the filter named applied so that we can display
            what the options are if it were unselected/unfiltered */
            var app = this;
            let copyFilters = { ...this.computedFilters };

            this.loadingQ++;

            /* Remove the filterName filter */
            copyFilters[filterName] = [] // assuming the filter object is an array for now
            graphqlQuery(gqlSingleGraph(filtersToChart[filterName]), {
                dataset: app.dataset,
                ...app.base_filters,
                ...copyFilters,
            }).then((data) => {
                this.loadingQ--;

                Object.entries(data.data.grantAggregates).forEach(([key, value]) => {
                    app.inactiveChartData[key] = value;
                });
            });
        },
        lineChartData(chart, field, bucketGroup, date_format) {
            var values = this.chartBars(chart, field, bucketGroup);
            if (date_format == 'month') {
                values = values.map((d) => ({
                    label: new Date(d.label + "-01"),
                    value: d.value
                }));
                values.sort((firstEl, secondEl) => firstEl.label - secondEl.label);
            }
            return {
                labels: values.map((d) => d.label),
                datasets: [{
                    label: field,
                    data: values.map((d) => d.value),
                    backgroundColor: COLOURS['orange'],
                    borderColor: COLOURS['orange'],
                    borderWidth: 0,
                    categoryPercentage: 1.0,
                    barPercentage: 1.0,
                }]
            }
        },
        chartBars(chart, field = 'grants', bucketGroup = 0, sort = true) {
            if (!this.chartData[chart]) { return []; }

            var chartData = this.chartData[chart];
            if (chart == 'byAmountAwarded') {
                chartData = chartData.filter((d) => d.bucketGroup[0].id == this.currencyUsed);
            }
            chartData = chartData.filter((d) => d.bucketGroup[bucketGroup].name);
            var maxValue = Math.max(...chartData.map((d) => d[field]));

            /* Initialise the graph data to include filters with default 0 value */
            var values = {}

            /* Look up the filter name for this chart */
            let chartFilter = chartToFilters[chart];

            if (chartFilter){

                this.filters[chartFilter].forEach((item) => (
                    values[item.id] = {
                        label: item.name,
                        id: item.id,
                        value: 0,
                        style: {
                            '--value': 0,
                            '--width': '0%',
                        }
                    }
                ));
            }



            /* Update or create the data entries */
            let duplicateIds = [];

            chartData.forEach((data) => {
                let entry = {
                    label: data.bucketGroup[bucketGroup].name,
                    id: data.bucketGroup[bucketGroup].id,
                    value: data[field],
                    style: {
                        '--value': data[field],
                        '--width': `${(data[field] / maxValue) * 100}%`,
                    }
                };

                if (values[data.bucketGroup[bucketGroup].id] && values[data.bucketGroup[bucketGroup].id].value > 0){
                    /* We have already set a value for this id. Sometimes multiple org-ids with
                    different data (e.g. org name) cause this */
                    duplicateIds.push(entry);
                } else {
                    values[data.bucketGroup[bucketGroup].id] = entry;              }
            });

            var inActiveValues = [];

            if (this.inactiveChartData[chart]){

                this.inactiveChartData[chart].forEach((inActiveData) => {

                    /* Don't add ourselves again */
                    if (values[inActiveData.bucketGroup[bucketGroup].id]){
                        return;
                    }

                    let entry = {
                        label: inActiveData.bucketGroup[bucketGroup].name,
                        id: inActiveData.bucketGroup[bucketGroup].id,
                        value: inActiveData[field],
                        style: {
                            '--value': inActiveData[field],
                            '--width': `${(inActiveData[field] / maxValue) * 100}%`,
                            'opacity': 0.5,
                            'overflow': 'hidden',
                        },
                        inactive: true,
                    };

//                    values[inActiveData.bucketGroup[bucketGroup].id] = entry;
                    inActiveValues.push(entry);
                });

            }

            /* Convert to an array now that we don't need to look up ids */
            values = Object.values(values);

            values = values.concat(duplicateIds);

            if (chart in this.bin_labels) {
                values.sort((firstEl, secondEl) => this.bin_labels[chart].indexOf(firstEl.label) - this.bin_labels[chart].indexOf(secondEl.label));
            } else if (sort) {

                values.sort((firstEl, secondEl) => secondEl.value - firstEl.value);

                values.sort(function (firstEl, secondEl) {
                    if (firstEl.inactive && secondEl.inactive){
                        return -1
                    }
                    return secondEl.value - firstEl.value
                 }); /* TODO sort the inactive to lower */
            }
            values = values.concat(inActiveValues);

            return values;
        },
        chartN(chart, field = 'grants', bucketGroup = 0) {
            if (!this.chartData[chart]) { return []; }
            return this.chartData[chart].filter((d) => d.bucketGroup[bucketGroup].name).reduce((acc, d) => acc + d[field], 0);
        },
        chartMissing(chart, field = 'grants', bucketGroup = 0) {
            if (!this.chartData[chart]) { return []; }
            return this.chartData[chart]
                .filter((d) => !d.bucketGroup[bucketGroup].name)
                .reduce((acc, d) => acc + d[field], 0);
        },
        getOptions(field) {
            /*if (!this.initialData[field]) { return []; }*/
            /*return this.initialData[field]*/
            return this.chartData[field]
                .filter((d) => d.bucketGroup[0].name)
                .map((d) => ({
                    value: d.bucketGroup[0].id,
                    label: d.bucketGroup[0].name,
                }));
        },
        toggleInArray(array, item){
            let idx = array.indexOf(item);
            if (idx > -1){
                /* Item exists remove it */
                array.splice(idx, 2);
            } else {
                array.push(item);
            }
        }

    },
    mounted() {
        console.log("MOUNTED");
        this.updateData();

        /* Only fetch data on mounted if we are loading with a predefined filter
        if (window.location.search) {
            var app = this;
            graphqlQuery(GQL, {
                dataset: app.dataset,
                ...initialFilters(true),
                ...app.base_filters,
            }).then((data) => {
                app.initialData = {};
                Object.entries(data.data.grantAggregates).forEach(([key, value]) => {
                    if (!["summary", "bySource"].includes(key)) {
                        app.initialData[key] = value;
                    }
                });
            });
        }*/
    }
})