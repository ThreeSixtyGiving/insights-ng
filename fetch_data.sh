#!/bin/sh
flask data fetch
flask data geonames
flask data update_dataset_stats
flask cache clear
