#!/bin/bash

docker run -itd \
  --name nacos \
  -e MODE=standalone \
  -p 0.0.0.0:8848:8848 \
  -p 0.0.0.0:9848:9848 \
  nacos/nacos-server:2.0.2


