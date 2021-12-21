
export const choropleth = {
    props: ['container', 'activeAreaIds', 'height'],
    data: function () {
        return {
            map: null,
            regionCountryLayer: null,
            mapbox_access_token: MAPBOX_ACCESS_TOKEN,
        };
    },
    methods: {
        updateMap() {

            var component = this;

            function getColor(d) {
                d = d / 1000;
                /* Leaflet choropleth example */
                return d > 1000 ? '#800026' :
                    d > 500 ? '#BD0026' :
                        d > 200 ? '#E31A1C' :
                            d > 100 ? '#FC4E2A' :
                                d > 50 ? '#FD8D3C' :
                                    d > 20 ? '#FEB24C' :
                                        d > 10 ? '#FED976' : '#FFEDA0';
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

            async function make(){

                let res = await fetch("/static/geo/country_region.geojson");
                let geoJson = await res.json()

                /* Add grant data to geojson */
                let regionsCountries = {};

                DATASET_SELECT["regions"].forEach((region) => {

                    regionsCountries[region.name] = {
                        grantCount: region.grant_count,
                        areaId: region.id
                    };

                });

                DATASET_SELECT["countries"].forEach((country) => {

                    regionsCountries[country.name] = {
                        grantCount: country.grant_count,
                        areaId: country.id,
                    };

                });

                geoJson.features.forEach((feature) => {
                    let name = feature.properties.nuts118nm.replace(" (England)", "");
                    feature.properties.grantCount = regionsCountries[name].grantCount;
                    feature.properties.areaId = regionsCountries[name].areaId;
                });


                let fl = L.geoJson(geoJson, {style: defaultStyle}).addTo(component.map);

                fl.bindPopup(function(layer){
                    let name_field = Object.keys(layer.feature.properties).find(el => el.endsWith("nm"));
                    return `<a href="/data?area=${layer.feature.properties.areaId}">${layer.feature.properties[name_field]} <br/>
                    ${layer.feature.properties.grantCount} grants`;
                });

                component.regionCountryLayer = fl;
            }

            make();
        }
    },
    watch: {
        markers: {
            handler: function () {
                this.updateMarkers();
            },
            deep: true,
        },
    },
    mounted() {
        L.mapbox.accessToken = this.mapbox_access_token;
        var map = L.mapbox.map(this.container, null, {
            attributionControl: { compact: true },
            zoomControl: true,
        }).setView([52.48, -1.9025], 7);
        L.mapbox.styleLayer('mapbox://styles/davidkane/cjvnt2h0007hm1clrbd20bbug').addTo(map);


        // disable scroll when map isn't focused
        map.scrollWheelZoom.disable();
        map.on('focus', function () { map.scrollWheelZoom.enable(); });
        map.on('blur', function () { map.scrollWheelZoom.disable(); });

        // ensure mapbox logo is shown (for attribution)
        document.querySelector('.mapbox-logo').classList.add('mapbox-logo-true');


        this.map = map;

        this.updateMap();
    },
    template: '<div v-bind:id="container" v-bind:style="{ height: height }"></div>'
}