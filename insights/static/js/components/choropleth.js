/* Property data expected format:
[
    {
        layerName: "name",
        areas: [
             { areaName : name, grant_count: int },
        ],
        layerBoundariesJsonFile: "file_name.geojson",
    },
]
*/


export const choropleth = {
    props: ['container', 'height', 'data', 'zoomControl'],
    data: function () {
        return {
            map: null,
            regionCountryLayer: null,
            laLayer: null,
            mapbox_access_token: MAPBOX_ACCESS_TOKEN,
        };
    },
    watch: {
        'data': function(){ this.updateMap(); },
    },

    methods: {
        updateMap() {

            var component = this;

            function getColor(d, maxGrantCount) {
                d = d / maxGrantCount;
                return d > 0.9 ? '#800026' :
                    d > 0.8 ? '#BD0026' :
                        d > 0.7 ? '#E31A1C' :
                            d > 0.6 ? '#FC4E2A' :
                                d > 0.5 ? '#FD8D3C' :
                                    d > 0.3 ? '#FEB24C' :
                                        d > 0.1 ? '#FED976' : '#FFEDA0';
            }

            function defaultStyle(feature) {

                return {
                    weight: 2,
                    opacity: 1,
                    color: 'white',
                    dashArray: '3',
                    fillOpacity: 0.7,
                    fillColor: getColor(feature.properties.grantCount, feature.properties.maxGrantCount)
                };

            }

            async function makeLayer(layer, addToMap){

                let geoJsonUrl = "/static/geo/"+layer.layerBoundariesJsonFile;
                let res = await fetch(geoJsonUrl);
                let geoJson = await res.json()

                let areaSelectLookup = {};

                layer.areas.forEach((area) => {
                  /* Create a lookup object for name->id with grant count */
                    areaSelectLookup[area.name] = {
                        grantCount: area.grant_count,
                        areaId: area.id
                    };
                });

                let maxGrantCount = 0;

                geoJson.features.forEach((feature) => {
                    let name = "";

                    if (feature.properties.nuts118nm){
                        name = feature.properties.nuts118nm.replace(" (England)", "");
                    } else if (feature.properties.CTYUA20NM) {
                        name = feature.properties.CTYUA20NM;
                    } else if (feature.properties.LAD20NM){
                        name = feature.properties.LAD20NM;
                    }

                    /* Not every region in the geojson will correspond with one in our data */
                    if (areaSelectLookup[name]) {
                        feature.properties.name = name;
                        feature.properties.grantCount = areaSelectLookup[name].grantCount;

                        if (areaSelectLookup[name].grantCount > maxGrantCount){
                            maxGrantCount = areaSelectLookup[name].grantCount;
                        }

                        feature.properties.areaId = areaSelectLookup[name].areaId;
                    } else {
                        feature.properties.name = name;
                        feature.properties.grantCount = 0;
                    }
                });

                /* Copy the maxGrantCount into each feature for colour calc */
                geoJson.features.forEach((feature) => {
                    feature.properties.maxGrantCount = maxGrantCount;
                });

                component[layer.layerName] = L.geoJson(geoJson, {style: defaultStyle})

                component[layer.layerName].bindPopup(function(layer){
                    /* Fixme  we need to use a callback or event here */
                    if (window.location.href.indexOf("/data") == -1) {
                        return `<a href="/data?area=${layer.feature.properties.areaId}">${layer.feature.properties.name} : ${layer.feature.properties.grantCount} grants`;
                    } else {
                        return `${layer.feature.properties.name} : ${layer.feature.properties.grantCount} grants`;
                    }
                });

                if (addToMap){
                    component[layer.layerName].addTo(component.map);
                }
            }

            this.map.eachLayer((layer)=> {
                if (!layer.keep){
                    layer.remove();
                }
            });

            for (let i in this.data){
                /* Only add layer 0 to the map */
                makeLayer(this.data[i], i == 0);
            }
        },

        zoom(){
            if (!this.zoomControl){
                return;
            }
            /* Toggle the two layers based on zoom level */
            /* Todo make generic */
            if (this.map.getZoom() > 7){
                /* more detailed layer*/
                if (this.map.hasLayer(this.regionCountryLayer)){
                    this.regionCountryLayer.remove();
                }

                if (!this.map.hasLayer(this.laLayer)){
                    this.laLayer.addTo(this.map);
                }

            } else {
                /* low detail layer */
                if (!this.map.hasLayer(this.regionCountryLayer)){
                    this.regionCountryLayer.addTo(this.map);
                }

                if (this.map.hasLayer(this.laLayer)){
                    this.laLayer.remove();
                }
            }
        }
    },
    mounted() {

        L.mapbox.accessToken = this.mapbox_access_token;
        var map = L.mapbox.map(this.$refs['mapElement'], null, {
            attributionControl: { compact: true },
            zoomControl: this.zoomControl,
        }).setView([54.55, -2], 6);
        let styleLayer = L.mapbox.styleLayer('mapbox://styles/davidkane/cjvnt2h0007hm1clrbd20bbug');
        styleLayer.keep = true;
        styleLayer.addTo(map);

        // disable scroll when map isn't focused
        map.scrollWheelZoom.disable();
        map.on('focus', function () { map.scrollWheelZoom.enable(); });
        map.on('blur', function () { map.scrollWheelZoom.disable(); });
        map.on('zoomend', this.zoom);

        // ensure mapbox logo is shown (for attribution)
        document.querySelector('.mapbox-logo').classList.add('mapbox-logo-true');

        this.map = map;
    },

    template: '<div v-bind:id="container" ref="mapElement" v-bind:style="{ height: height }"></div>'
}
