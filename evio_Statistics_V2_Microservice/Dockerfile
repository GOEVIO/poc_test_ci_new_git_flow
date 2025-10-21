FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest

RUN apt-get update && apt-get install -y git

WORKDIR /usr/src/
COPY ./evio-event-producer ./evio-event-producer
WORKDIR /usr/src/evio-event-producer
RUN npm install
RUN npm run build

WORKDIR /usr/src/app
COPY ./evio_Statistics_V2_Microservice .
COPY ./evio_Statistics_V2_Microservice/.npmrc /root/.npmrc

WORKDIR /usr/src/app
COPY ./evio_Statistics_V2_Microservice .
RUN npm install --maxsockets=1 --legacy-peer-deps
RUN npm run build
EXPOSE 3031
