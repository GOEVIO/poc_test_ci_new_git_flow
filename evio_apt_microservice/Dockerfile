FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest

WORKDIR /usr/src/
RUN mkdir local-npm-packages

WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-library-connections ./evio-library-connections
WORKDIR /usr/src/local-npm-packages/evio-library-connections
RUN npm install
RUN npm run build

WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-toggle ./evio-toggle
WORKDIR /usr/src/local-npm-packages/evio-toggle
RUN npm install
RUN npm run build

WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-library-commons ./evio-library-commons
WORKDIR /usr/src/local-npm-packages/evio-library-commons
RUN npm install
RUN npm run build

WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-redis-connection ./evio-redis-connection
WORKDIR /usr/src/local-npm-packages/evio-redis-connection
RUN npm install
RUN npm run build

WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-library-configs ./evio-library-configs
WORKDIR /usr/src/local-npm-packages/evio-library-configs
RUN npm install
RUN npm run build

WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-library-ocpi ./evio-library-ocpi
WORKDIR /usr/src/local-npm-packages/evio-library-ocpi
RUN npm install
RUN npm run build

WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-library-chargers ./evio-library-chargers
WORKDIR /usr/src/local-npm-packages/evio-library-chargers
RUN npm install
RUN npm run build

WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-library-tariffs ./evio-library-tariffs
WORKDIR /usr/src/local-npm-packages/evio-library-tariffs
RUN npm install
RUN npm run build

WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-library-identity ./evio-library-identity
WORKDIR /usr/src/local-npm-packages/evio-library-identity
RUN npm install
RUN npm run build

WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-library-payments ./evio-library-payments
WORKDIR /usr/src/local-npm-packages/evio-library-payments
RUN npm install
RUN npm run build

WORKDIR /usr/src/app
COPY ./evio_apt_microservice .
RUN npm install
RUN npm run build
EXPOSE 6001
