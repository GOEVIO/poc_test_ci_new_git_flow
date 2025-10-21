FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest

RUN apt-get update && apt-get install -y git

WORKDIR /usr/src/app
RUN mkdir evio_rabbitmq_workers

WORKDIR /usr/src/app
COPY ./evio_rabbitmq_workers/update-plug-status .
COPY ./evio_rabbitmq_workers/update-plug-status/.npmrc /root/.npmrc

WORKDIR /usr/src/app/evio_rabbitmq_workers
COPY ./evio_rabbitmq_workers/update-plug-status .

RUN npm cache clean --force
RUN npm install
RUN npm run build