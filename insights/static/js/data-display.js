import { lineChart } from './components/line-chart.js';
import { barChart } from './components/bar-chart.js';
import { GQL, gqlSingleGraph, graphqlQuery } from './gql/query.js';
import { formatCurrency, formatDate, formatNumber, getAmountSuffix, formatNumberSuffix } from './components/filters.js';
import { debounce } from './lib/debounce.js';

const COLOURS = {
    yellow: "#EFC329",
    red: "#BC2C26",
    teal: "#4DACB6",
    orange: "#DE6E26",
}

import { choropleth } from './components/choropleth.js';

Vue.component('choropleth', choropleth);

Vue.component('bar-chart', barChart);
Vue.component('line-chart', lineChart);

Vue.filter('formatCurrency', formatCurrency);
Vue.filter('formatDate', formatDate);
Vue.filter('formatNumber', formatNumber);
Vue.filter('getAmountSuffix', getAmountSuffix);
Vue.filter('formatNumberSuffix', formatNumberSuffix);

function constructMonth(month, year) {
    if (month && year) {
        return year + '-' + month;
    }
    else {
        return null;
    }
}

function initialFilters(useQueryParams) {
    var params = new URLSearchParams(window.location.search);

    if(!useQueryParams){
        params = new URLSearchParams();
    }

    let areas = [];
    /* These keys may be set from the homepage but they're all areas */
    areas.push(...params.getAll("regions"));
    areas.push(...params.getAll("countries"));
    areas.push(...params.getAll("area"));

    return {
        awardAmount: {
            min: params.get("awardAmount.min"),
            max: params.get("awardAmount.max"),
        },
        awardDates: {
            min: {
                 month: params.get("awardDates.min.month"),
                 year: params.get("awardDates.min.year"),
            },
            max: {
                 month: params.get("awardDates.max.month"),
                 year: params.get("awardDates.max.year"),
            }
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
        area: areas,
        orgtype: params.getAll("orgtype"),
        grantProgrammes: params.getAll("grantProgrammes"),
        funders: params.getAll("funders"),
        funderTypes: params.getAll("funderTypes"),
        localAuthorities: params.getAll("localAuthorities"),
    }
}

var filtersToTitles = {
    awardAmount: "Award amounts",
    awardDates: "Award dates",
    orgSize: "Size of recipient organisations",
    orgAge: "Age of recipient organisations",
    orgtype: "Recipient type",
    grantProgrammes: "Grant programmes",
    funders: "Funders",
    funderTypes: "Funder types",
    area: "Location",
    localAuthorities: "Local Authorities",
}

var chartToFilters = {
    byGrantProgramme: 'grantProgrammes',
    byFunder: 'funders',
    byFunderType: 'funderTypes',
    byCountryRegion: 'area',
    byOrgType: 'orgtype',
    byLocalAuthority: 'localAuthorities',
}

/* Same as above but k,v swapped */
var filtersToChart = Object.fromEntries(Object.entries(chartToFilters).map(([key,val]) => [val, key] ));

function clamp(num, min, max){
    return Math.min(Math.max(num, min), max);
}

var app = new Vue({
    el: '#data-display',
    data() {
        return {
            dataset: DATASET,
            datasetExpiryDays: DATASET_EXPIRY_DAYS,
            title: TITLE,
            subtitle: SUBTITLE,
            bin_labels: BIN_LABELS,
            loading: false,
            loadingQ: 0,
            initialData: null,
            chartData: {},
            inactiveChartData: {},
            summary: {
                grants: 0,
                recipients: 0,
                currencies:[ {
                    currency: "GBP",
                    grants: 0,
                    total: 0,
                    mean: 0,
                }],
            },
            default_currency: 'GBP',
            funders: [],
            base_filters: BASE_FILTERS,
            filters: initialFilters(true),
            source_ids: [],
            sources: [],
            grants: [],
            mapUrl: PAGE_URLS['map'],
            dataUrl: PAGE_URLS['data'],
            find: { funder: "", grantProgramme: "", localAuthority: "" },
            filtersToTitles: filtersToTitles,
            filterDates: { ...initialFilters(true).awardDates },
            choroplethData: [],
        }
    },
    computed: {
        computedFilters() {
            /* Take a copy of the filters */
            var filters = JSON.parse(JSON.stringify(this.filters));

            filters.awardDates.min = constructMonth(filters.awardDates.min.month, filters.awardDates.min.year);
            filters.awardDates.max = constructMonth(filters.awardDates.max.month, filters.awardDates.max.year);

            /* convert the filter data into data for graphql query */
            ['awardAmount', 'orgSize', 'orgAge'].forEach((field) => {
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
        filtersApplied(){
            let activeFilters = [];

            if (!window.location.search && this.dataset == 'main'){
                window.location.href = "/";
                return activeFilters;
            }

            for (let filter in this.computedFilters){
                if (this.computedFilters[filter].length || this.computedFilters[filter].min || this.computedFilters[filter].max){
                    if (activeFilters.indexOf(filter) == -1){
                        activeFilters.push(filter);
                    }
                }
            }
            return activeFilters;
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
        grantnavUrl: function () {
            // TODO, look this up from the config
            var url = 'https://grantnav.threesixtygiving.org/search?';

            var searchParams = new URLSearchParams();

            if (this.filters.orgtype.length) {
                return null;
            }

            if (this.filters.awardAmount.min) {
                searchParams.append('min_amount', this.filters.awardAmount.min);
            }
            if (this.filters.awardAmount.max) {
                searchParams.append('max_amount', this.filters.awardAmount.max);
            }

            if (this.filters.awardDates.min.month && this.filters.awardDates.min.year) {
                searchParams.append('min_date', this.filters.awardDates.min.month + '/' + this.filters.awardDates.min.year);
            }
            if (this.filters.awardDates.max.month && this.filters.awardDates.max.year) {
                searchParams.append('max_date', this.filters.awardDates.max.month + '/' + this.filters.awardDates.max.year);
            }

            var text_query = '';
            this.filters.area.forEach((area) => {
                var area_prefix = area.slice(0, 3);
                if (['E06', 'E07', 'E08', 'E09', 'N09', 'S12', 'W06'].includes(area_prefix)) {
                    text_query += ' additional_data.recipientDistrictGeoCode:' + area;
                } else if (['E12'].includes(area_prefix)) {
                    text_query += ' additional_data.recipientOrganizationLocation.rgn:' + area;
                } else if (['E92', 'N92', 'S92', 'W92'].includes(area_prefix)) {
                    text_query += ' additional_data.recipientOrganizationLocation.ctry:' + area;
                }
            });
            if (text_query) {
                searchParams.append('query', text_query);
            }

            this.filters.funderTypes.forEach((funderType) => {
                searchParams.append('fundingOrganizationTSGType', funderType)
            });
            this.filters.funders.forEach((funder) => {
                searchParams.append('fundingOrganization', funder);
            });
            this.filters.grantProgrammes.forEach((grantProgramme) => {
                searchParams.append('grantProgramme', grantProgramme);
            });
            return url + searchParams.toString();
        },
    },
    watch: {

        /* TODO make the find. watchers generic
           Filter the <li> in the graph list for the specified term
           requires ref to be set and data-label on the li
        */
        'find.funder': function () {
            var app = this;
            this.$refs.byFunderItem.forEach((li) => {
                li.style.display = null;
                if (li.dataset.label && app.find.funder && !li.dataset.label.toLowerCase().includes(app.find.funder.toLowerCase())){
                    li.style.display = "none";
                }
            });
        },
        'find.grantProgramme': function(){
            /* Filter the <li> in the graph list for the specified term */
            var app = this;
            this.$refs.byGrantProgrammeItem.forEach((li) => {
                li.style.display = null;
                if (li.dataset.label && app.find.grantProgramme && !li.dataset.label.toLowerCase().includes(app.find.grantProgramme.toLowerCase())){
                    li.style.display = "none";
                }
            });
        },
        'find.localAuthority': function () {
            /* Filter the <li> in the graph list for the specified term */
            var app = this;
            this.$refs.byLocalAuthorityItem.forEach((li) => {
                li.style.display = null;
                if (li.dataset.label && app.find.localAuthority && !li.dataset.label.toLowerCase().includes(app.find.localAuthority.toLowerCase())) {
                    li.style.display = "none";
                }
            });
        },
        'loadingQ': function () {
            if (this.loadingQ > 0) {
                this.loading = true;
            } else {
                this.loading= false;
            }
        },
        'filters': {
            handler: debounce(function () {
                this.find.grantProgramme = "";
                this.find.funder = "";
                this.updateUrl();
                this.updateData();
            }, 1000),
            deep: true,
            immediate: false,
        },
        'filterDates': {
            handler: function(){
                for (let range of ["min", "max"]){
                    if (this.filterDates[range].month && this.safeLength(this.filterDates[range].year) == 4){
                        this.filters.awardDates[range].month = this.filterDates[range].month;
                        this.filters.awardDates[range].year = this.filterDates[range].year;
                    }
                }
            },
            deep: true,
        }
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
                                if(typeof w == "object" && l != null) {
                                    Object.entries(w)
                                        .filter(([m, x]) => x && x.length != 0)
                                        .forEach(([m, x]) => {
                                            queryParams.append(`${k}.${l}.${m}`, x);
                                        });
                                }
                                else {
                                    queryParams.append(`${k}.${l}`, w);
                                }
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
        resetFilter(name) {
            if (this.filters[name].min || this.filters[name].max){
                this.filters[name].min = 0;
                this.filters[name].max = 0;
            } else if (Array.isArray(this.filters[name])) {
                this.filters[name] = [];
            } else if (typeof(this.filters[name] === 'string')){
                this.filters[name] = '';
            } else {
                this.filters[name] = null;
            }

            if (name == "awardDates"){
                this.filterDates = {
                    min: { month: null, year: null },
                    max: { month: null, year: null }
                };
            }
        },
        updateData() {
            /* If no search filters do nothing */

            if (!this.filtersApplied.length && this.dataset == 'main'){
                window.location.href = '/'
                return;
            }

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

                app.updateChoropleth();

                app.loadingQ--;
            });

            /* depending on the filters set find out what the data options would have been */
            if (this.filtersApplied.length) {
                ['funders', 'funderTypes', 'area', 'orgtype', 'grantProgrammes', 'localAuthorities'].forEach((filter) => {
                    if (app.filters[filter].length > 0) {
                        this.dataWithoutFilter(filter);
                    }
                });
            }
        },
        dataWithoutFilter(filterName){
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
        /* Special function to parse the amount awarded chart bins data */
        applyAmountAwardedFilter(item){
            let minMax = this.bin_labels.byAmountAwarded[item.label];
            this.filters.awardAmount.min = minMax[0]+1;
            this.filters.awardAmount.max = minMax[1];
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

            /* Update or create the data entries */
            chartData.forEach((data) => {
                let total = 0;
                /* We have already set a value for this id. Merge this entry */
                if (values[data.bucketGroup[bucketGroup].id] && values[data.bucketGroup[bucketGroup].id].value > 0){
                    total = values[data.bucketGroup[bucketGroup].id].value + data[field];
                } else {
                    total = data[field]
                }

                let entry = {
                    label: data.bucketGroup[bucketGroup].name,
                    id: data.bucketGroup[bucketGroup].id,
                    value: total,
                    style: {
                        '--value': total,
                        '--width': `${clamp(((total / maxValue) * 100), 0.1, 100)}%`,
                    }
                };

                values[data.bucketGroup[bucketGroup].id] = entry;
            });

            var inActiveValues = {};

            if (this.inactiveChartData[chart]){
                this.inactiveChartData[chart].forEach((inActiveData) => {

                    /* Don't add an inactive value of ourselves */
                    if (values[inActiveData.bucketGroup[bucketGroup].id]){
                        return;
                    }

                    let total = 0;
                    /* We have already set a value for this id. Merge this entry */
                    if (inActiveValues[inActiveData.bucketGroup[bucketGroup].id] && inActiveValues[inActiveData.bucketGroup[bucketGroup].id].value > 0){
                        total = inActiveValues[inActiveData.bucketGroup[bucketGroup].id].value + inActiveData[field];
                    } else {
                        total = inActiveData[field]
                    }

                    let entry = {
                        label: inActiveData.bucketGroup[bucketGroup].name,
                        id: inActiveData.bucketGroup[bucketGroup].id,
                        value: total,
                        style: {
                            '--value': total,
                            '--width': `${clamp(((total / maxValue) * 100), 0.1, 100)}%`,
                            'overflow': 'hidden',
                        },
                        inactive: true,
                    };

                    inActiveValues[inActiveData.bucketGroup[bucketGroup].id] = entry;


                });
            }

            /* Convert to an array now that we don't need to look up ids */
            values = Object.values(values);
            inActiveValues = Object.values(inActiveValues);

            if (chart in this.bin_labels) {
                let labels = Object.keys(this.bin_labels[chart]);
                values.sort((firstEl, secondEl) => labels.indexOf(firstEl.label) - labels.indexOf(secondEl.label));
            } else if (sort) {
                values.sort((firstEl, secondEl) => secondEl.value - firstEl.value);
                inActiveValues.sort((firstEl, secondEl) => secondEl.value - firstEl.value);
            }

            /* Add the (unsorted) inactive values so that they're below the active ones */
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
        updateChoropleth() {
            if (!this.chartData.byCountryRegion || !this.chartData.byLocalAuthority) {
                return [];
            };

            let areas = [];
            let laAreas = [];

            this.chartData.byCountryRegion.forEach((area) => {
                if (!area.bucketGroup[0].id) {
                    return;
                }

                let choroplethArea = {};

                /* England is split into regions */
                if (area.bucketGroup[0].id == "E92000001") {
                    choroplethArea = { ...area.bucketGroup[1] };
                } else {
                    choroplethArea = { ...area.bucketGroup[0] };
                }

                choroplethArea.grant_count = area.grants;
                areas.push(choroplethArea);
            });

            this.chartData.byLocalAuthority.forEach((area) => {
                if (!area.bucketGroup[0].id) {
                    return;
                }

                let choroplethArea = {};
                choroplethArea = { ...area.bucketGroup[0] };
                choroplethArea.grant_count = area.grants;

                laAreas.push(choroplethArea);
            });

            this.choroplethData = [
                {
                    layerName: "regionCountryLayer",
                    areas: areas,
                    layerBoundariesJsonFile: "country_region.geojson",
                    popupHandler: function(layer){
                        return `<a href="#map" data-filter="area" data-area="${layer.feature.properties.areaId}" onClick="this.dispatchEvent(new Event('map-select', {bubbles: true}))" >${layer.feature.properties.name} : ${layer.feature.properties.grantCount} grants</a>`;
                    },
                },
                {
                    layerName: "laLayer",
                    areas: laAreas,
                    layerBoundariesJsonFile: "lalt.geojson",
                    popupHandler: function(layer){
                        return `<a href="#map" data-filter="localAuthorities" data-area="${layer.feature.properties.areaId}" onClick="this.dispatchEvent(new Event('map-select', {bubbles: true}))" >${layer.feature.properties.name} : ${layer.feature.properties.grantCount} grants</a>`;
                    },
                }
            ]
        },
        toggleInArray(array, item){
            let idx = array.indexOf(item);
            if (idx > -1){
                /* Item exists remove it */
                array.splice(idx, 2);
            } else {
                array.push(item);
            }
        },
        safeLength(array){
            /* utility for avoiding race conditions on determining length in templates */
            if (!array){
                return 0;
             }

             return array.length;
        }

    },
    mounted() {
        this.updateData();

        let app = this;

        document.addEventListener("map-select", function(event){
            event.preventDefault();
            app.toggleInArray(app.filters[event.target.dataset.filter], event.target.dataset.area);
        });
    }
})
