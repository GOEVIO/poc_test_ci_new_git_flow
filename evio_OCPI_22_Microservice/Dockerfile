FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest

RUN apt-get update && apt-get install -y git

WORKDIR /usr/src/
COPY ./evio-event-producer ./evio-event-producer
WORKDIR /usr/src/evio-event-producer
RUN npm install
RUN npm run build

WORKDIR /usr/src/app

# Copie apenas arquivos de dependências e .npmrc para melhor cache
COPY ./evio_OCPI_22_Microservice/package*.json ./
COPY ./evio_OCPI_22_Microservice/.npmrc /root/.npmrc

# Instala dependências
RUN npm cache clean --force
RUN npm install

# Copie o restante da aplicação
COPY ./evio_OCPI_22_Microservice .

# (Opcional) Remova .npmrc após instalar dependências
RUN rm -f /root/.npmrc

EXPOSE 3019

CMD ["npm", "start"]