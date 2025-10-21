FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest

WORKDIR /usr/src/app

COPY ./evio_platform /usr/src/app

RUN yarn --silent --ignore-engines

RUN yarn build

CMD ["yarn", "start:prod"]
