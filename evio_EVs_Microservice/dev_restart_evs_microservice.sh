#/bin/bash

docker image prune -f
docker-compose -f ../docker-compose-dev-evs.yml down
docker-compose -f ../docker-compose-dev-evs.yml build
docker-compose -f ../docker-compose-dev-evs.yml up 

sleep 10