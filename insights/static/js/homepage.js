import { formatCurrency, formatDate, formatNumber, getAmountSuffix, formatNumberSuffix } from './components/filters.js';

Vue.filter('formatCurrency', formatCurrency);
Vue.filter('formatDate', formatDate);
Vue.filter('formatNumber', formatNumber);
Vue.filter('getAmountSuffix', getAmountSuffix);
Vue.filter('formatNumberSuffix', formatNumberSuffix);

import { choropleth } from './components/choropleth.js';

import { mapboxMap } from './components/map.js';
Vue.component('mapbox-map', mapboxMap);
Vue.component('choropleth', choropleth);
Vue.component('multi-select', window.VueMultiselect.default);

var app = new Vue({
    el: '#app',
    data() {
        return {
            uploadModal: false,
            loading: false,
            uploadStatus: null,
            uploadFile: null,
            uploadSourceTitle: null,
            uploadSourceDescription: null,
            uploadSourceLicense: null,
            uploadSourceLicenseName: null,
            uploadError: null,
            datasetSelect: DATASET_SELECT,
            datasetSelectSections: {
                funders: "Funders",
                funderTypes: "Funding organisation type",
                // publishers: "Publishers",
                countries: "Countries",
                regions: "Regions",
                localAuthorities: "Local authorities",
            },
            find: {
                funders: "",
                funderTypes: "",
                countries: "",
                regions: "",
                localAuthorities: "",
            },
            maxGrantCounts: {}, /* cache of max count */
        }
    },
    watch: {
        find: {
            deep: true,
            handler: function(){
                for (let field in this.find){
                    if (this.find[field].length == 0){
                        continue;
                    }
                    /* Filter the <li> in the graph list for the specified term */
                    var app = this;
                    this.$refs[field].forEach((li) => {
                        li.style.display = null;
                        if (li.dataset.label && app.find[field] && !li.dataset.label.toLowerCase().includes(app.find[field].toLowerCase())){
                            li.style.display = "none";
                        }
                    });

                    console.log(this.find[field]);
                }
            }
        }

    },
    methods: {
        getDatasetOptions: function (field) {
            return this.datasetSelect[field];
        },
        openDataPage(filterK, filterV){
            window.location = `/data?${filterK}=${filterV}`;
        },
        barStyle: function(field, value){
            if (!this.maxGrantCounts[field]){
                this.maxGrantCounts[field] = Math.max(...Object.values (this.datasetSelect[field]).map((dataOb) => dataOb.grant_count))
            }
            return  {
                '--value': value,
                '--width': `${(value / this.maxGrantCounts[field]) * 100}%`,
            }
        },

        addFile: function(e){
            let droppedFiles;
            if(e.dataTransfer){
                droppedFiles = e.dataTransfer.files;
            } else {
                droppedFiles = e.target.files;
            }
            if(!droppedFiles) return;
            this.uploadFile = droppedFiles[0];
            this.uploadSourceTitle = droppedFiles[0].name;
            this.uploadStatus = 'ready';
        },
        startUpload: function(){
            var component = this;
            this.uploadError = null;
            this.uploadStatus = 'uploading';
            this.loading = true;
            let formData = new FormData();
            formData.append('file', this.uploadFile);
            formData.append('source_title', this.uploadSourceTitle);
            formData.append('source_description', this.uploadSourceDescription);
            formData.append('source_license', this.uploadSourceLicense);
            formData.append('source_license_name', this.uploadSourceLicenseName);
            fetch(UPLOAD_URL, {method: "POST", body: formData})
                .then(response => response.json())
                .then(data => {
                    console.log(data);
                    window.location.replace(data.data_url);
                })
                .catch(error => {
                    component.uploadError = 'Could not upload file';
                    component.loading = false;
                    component.uploadStatus = 'ready';
                });
        },
        openFileDialog: function(){
            this.$refs.uploadFileInput.click();
        }
        },

});