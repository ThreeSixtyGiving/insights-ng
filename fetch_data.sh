#!/bin/sh
if [ $DISABLE_UPDATES ]; then exit 0; fi
flask data fetch
flask data geonames
flask data update_dataset_stats
flask cache clear
