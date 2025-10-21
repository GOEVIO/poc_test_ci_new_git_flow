FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest

# install git due to dependency
RUN apt-get update && apt-get install -y git

WORKDIR /usr/src/app

# Copie apenas arquivos de dependências e .npmrc para melhor cache
COPY ./oicp/package*.json ./
COPY ./oicp/.npmrc /root/.npmrc

COPY ./oicp .

RUN yarn --silent --ignore-engines

RUN yarn build

# Remove .npmrc after install (opcional)
RUN rm -f /root/.npmrc

CMD ["yarn", "start:prod"]
