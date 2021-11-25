import { formatNumber } from './components/filters.js';

Vue.filter('formatNumber', formatNumber);

Vue.component('multi-select', window.VueMultiselect.default)

function initMultiSelectGrantTotals(){
    let ret = {}
    for (const field in DATASET_SELECT_SECTIONS){
        ret[field] = { totalGrants: 0}
    }

    return ret;
}

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
            datasetSelectSections: DATASET_SELECT_SECTIONS,
            maxListLength: 10,
            multiSelect: {},
            multiSelectGrantTotals: initMultiSelectGrantTotals(),
        }
    },
    methods: {
        getDatasetOptions: function (field) {
            return this.datasetSelect[field];
        },

        multiSelectSelected: function(field, event){
            this.multiSelectGrantTotals[field].totalGrants += event.grant_count;
        },

        viewInsights: function(field, event){
            if (this.multiSelect[field].length === 1){
                window.location = this.multiSelect[field][0].url;
            } else {
                let query = new URLSearchParams();

                for (const data of this.multiSelect[field]){
                    query.append("selected", data.id);
                }

                window.location = `${field}/?${query.toString()}`;
            }
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

});