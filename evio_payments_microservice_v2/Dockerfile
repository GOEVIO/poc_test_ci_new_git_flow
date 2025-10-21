FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest

RUN apt-get update && apt-get install -y git

WORKDIR /usr/src/app

# Copia apenas arquivos de dependências e .npmrc para melhor cache
COPY ./evio_payments_microservice_v2/package*.json ./
COPY ./evio_payments_microservice_v2/.npmrc /root/.npmrc

# Instala dependências
RUN npm cache clean --force
RUN npm install

# Copia o restante da aplicação
COPY ./evio_payments_microservice_v2 .

# Build da aplicação
RUN npm run build

# (Opcional) Remove .npmrc após build
RUN rm -f /root/.npmrc

EXPOSE 6002

CMD ["npm", "run", "start:prod"]
