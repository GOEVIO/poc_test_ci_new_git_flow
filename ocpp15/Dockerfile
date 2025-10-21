FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest

# Install git due to dependency
RUN apt-get update && apt-get install -y git

# (Optional) Copy .npmrc for private registry/auth if needed
COPY ./ocpp15/.npmrc /root/.npmrc

WORKDIR /usr/src/app

COPY ./ocpp15 .

RUN yarn --silent --ignore-engines

RUN yarn build

# Remove .npmrc after install (opcional)
RUN rm -f /root/.npmrc

CMD ["yarn", "start:prod"]