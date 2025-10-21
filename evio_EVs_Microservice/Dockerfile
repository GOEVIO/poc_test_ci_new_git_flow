FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest

RUN apt-get update && apt-get install -y git

WORKDIR /usr/src/app
COPY ./evio_EVs_Microservice .
COPY ./evio_EVs_Microservice/.npmrc /root/.npmrc

WORKDIR /usr/src/app
COPY ./evio_EVs_Microservice .
RUN npm install --maxsockets=1
EXPOSE 3006
