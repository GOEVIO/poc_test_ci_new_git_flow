FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest
# FROM node:20-slim

RUN apt-get update && apt-get install -y git

# create a new directory for the packages
WORKDIR /usr/src/
RUN mkdir local-npm-packages

# copy the packages to the new directory
WORKDIR /usr/src/local-npm-packages

COPY ./local-npm-packages/evio-library-connections ./evio-library-connections
COPY ./local-npm-packages/evio-redis-connection ./evio-redis-connection
COPY ./local-npm-packages/evio-toggle ./evio-toggle
COPY ./local-npm-packages/evio-library-commons ./evio-library-commons
COPY ./local-npm-packages/evio-library-configs ./evio-library-configs
COPY ./local-npm-packages/evio-library-evs ./evio-library-evs
COPY ./local-npm-packages/evio-library-ocpi ./evio-library-ocpi
COPY ./local-npm-packages/evio-library-tariffs ./evio-library-tariffs
COPY ./local-npm-packages/evio-library-identity ./evio-library-identity

# build packages
WORKDIR /usr/src/local-npm-packages/evio-library-connections
RUN npm install
RUN npm run build

WORKDIR /usr/src/local-npm-packages/evio-redis-connection
RUN npm install
RUN npm run build

WORKDIR /usr/src/local-npm-packages/evio-toggle
RUN npm install
RUN npm run build

WORKDIR /usr/src/local-npm-packages/evio-library-commons
RUN npm install
RUN npm run build

WORKDIR /usr/src/local-npm-packages/evio-library-configs
RUN npm install
RUN npm run build

WORKDIR /usr/src/local-npm-packages/evio-library-evs
RUN npm install
RUN npm run build

WORKDIR /usr/src/local-npm-packages/evio-library-ocpi
RUN npm install
RUN npm run build

WORKDIR /usr/src/local-npm-packages/evio-library-tariffs
RUN npm install
RUN npm run build

WORKDIR /usr/src/local-npm-packages/evio-library-identity
RUN npm install
RUN npm run build

# copy and build the app
WORKDIR /usr/src/app

COPY ./assets /usr/src/app

RUN npm i

RUN npm run build

EXPOSE 3103

CMD ["npm", "run", "start:prod"]
