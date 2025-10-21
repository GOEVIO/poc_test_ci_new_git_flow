FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node22:14.0
# FROM node:20-slim

# Install git
RUN apt-get update && apt-get install -y git

# Base working directory
WORKDIR /usr/src/
RUN mkdir local-npm-packages

#############################
# Build local npm packages
#############################

# evio-toggle
WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-toggle ./evio-toggle
WORKDIR /usr/src/local-npm-packages/evio-toggle
RUN npm install && npm run build

# evio-library-commons
WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-library-commons ./evio-library-commons
WORKDIR /usr/src/local-npm-packages/evio-library-commons
RUN npm install --maxsockets=1 && npm run build

# evio-library-connections
WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-library-connections ./evio-library-connections
WORKDIR /usr/src/local-npm-packages/evio-library-connections
RUN npm install
RUN npm run build

# evio-library-payments
WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-library-payments ./evio-library-payments
WORKDIR /usr/src/local-npm-packages/evio-library-payments
RUN npm install && npm run build

# evio-redis-connection
WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-redis-connection ./evio-redis-connection
WORKDIR /usr/src/local-npm-packages/evio-redis-connection
RUN npm install && npm run build

# evio-library-configs
WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-library-configs ./evio-library-configs
WORKDIR /usr/src/local-npm-packages/evio-library-configs
RUN npm install && npm run build

# evio-library-tariffs
WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-library-tariffs ./evio-library-tariffs
WORKDIR /usr/src/local-npm-packages/evio-library-tariffs
RUN npm install && npm run build

# evio-library-ocpi
WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-library-ocpi ./evio-library-ocpi
WORKDIR /usr/src/local-npm-packages/evio-library-ocpi
RUN npm install && npm run build

# evio-library-identity
WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-library-identity ./evio-library-identity
WORKDIR /usr/src/local-npm-packages/evio-library-identity
RUN npm install && npm run build

# evio-library-chargers
WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-library-chargers ./evio-library-chargers
WORKDIR /usr/src/local-npm-packages/evio-library-chargers
RUN npm install && npm run build

#evio-redis-connection
WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-redis-connection ./evio-redis-connection
WORKDIR /usr/src/local-npm-packages/evio-redis-connection
RUN npm install && npm run build

#evio-library-language
WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-library-language ./evio-library-language
WORKDIR /usr/src/local-npm-packages/evio-library-language
RUN npm install && npm run build

#evio-event-producer
WORKDIR /usr/src
COPY ./evio-event-producer ./evio-event-producer
WORKDIR /usr/src/evio-event-producer
RUN npm install
RUN npm run build

#evio-library-billing
WORKDIR /usr/src/local-npm-packages
COPY ./local-npm-packages/evio-library-billing ./evio-library-billing
WORKDIR /usr/src/local-npm-packages/evio-library-billing
RUN npm install && npm run build

##########################################
# Main application
##########################################

WORKDIR /usr/src/app
COPY ./evio_Billing_V2_Microservice .

RUN npm install --maxsockets=1

RUN npm run build

EXPOSE 3017

CMD ["npm", "run", "start"]