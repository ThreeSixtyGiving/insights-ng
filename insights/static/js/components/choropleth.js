
export const choropleth = {
    props: ['container', 'height'],
    data: function () {
        return {
            map: null,
            regionCountryLayer: null,
            laLayer: null,
            mapbox_access_token: MAPBOX_ACCESS_TOKEN,
        };
    },
    methods: {
        updateMap() {

            var component = this;
            var maxGrantCount = 0;

            function getColor(d) {
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
                    fillColor: getColor(feature.properties.grantCount)
                };

            }

            async function makeLayer(layer, dataSelect, geoJsonUrl, addToMap){

                let res = await fetch(geoJsonUrl);
                let geoJson = await res.json()

                let areaSelectLookup = {};


                dataSelect.forEach((dataSelect) => {
                  /* Create a lookup object for name->id with grant count */

                    DATASET_SELECT[dataSelect].forEach((area) => {

                        areaSelectLookup[area.name] = {
                            grantCount: area.grant_count,
                            areaId: area.id
                        };
                    });
                });

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


                component[layer] = L.geoJson(geoJson, {style: defaultStyle})

                component[layer].bindPopup(function(layer){
                    return `<a href="/data?area=${layer.feature.properties.areaId}">${layer.feature.properties.name}</a>:
                    ${layer.feature.properties.grantCount} grants`;
                });

                if (addToMap){
                    component[layer].addTo(component.map);
                }
            }

            makeLayer("laLayer", ["localAuthorities"], "/static/geo/lalt.geojson", false);
            makeLayer("regionCountryLayer", ["regions", "countries"], "/static/geo/country_region.geojson", true);
        },

        zoom(){
            /* Toggle the two layers based on zoom level */
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
        var map = L.mapbox.map(this.container, null, {
            attributionControl: { compact: true },
            zoomControl: true,
        }).setView([54.55, -2], 6);
        L.mapbox.styleLayer('mapbox://styles/davidkane/cjvnt2h0007hm1clrbd20bbug').addTo(map);

        // disable scroll when map isn't focused
        map.scrollWheelZoom.disable();
        map.on('focus', function () { map.scrollWheelZoom.enable(); });
        map.on('blur', function () { map.scrollWheelZoom.disable(); });
        map.on('zoomend', this.zoom);

        // ensure mapbox logo is shown (for attribution)
        document.querySelector('.mapbox-logo').classList.add('mapbox-logo-true');

        this.map = map;

        this.updateMap();
    },
    template: '<div v-bind:id="container" v-bind:style="{ height: height }"></div>'
}
