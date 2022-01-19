#!/usr/bin/env python3

import json
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("in_f", type=str)
parser.add_argument("out", type=str)

args = parser.parse_args()

with open(args.in_f, "r") as f:
    obj = json.load(f)
    with open(args.out, "w") as o_f:
        json.dump(obj, o_f, separators=(',', ':'))
