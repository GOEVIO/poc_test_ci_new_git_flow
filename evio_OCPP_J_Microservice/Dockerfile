FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest

RUN apt-get update && apt-get install -y git

WORKDIR /usr/src/app

# Copie apenas arquivos de dependências e .npmrc para melhor cache
COPY ./evio_OCPP_J_Microservice/package*.json ./
COPY ./evio_OCPP_J_Microservice/.npmrc /root/.npmrc

# Instala dependências
RUN npm cache clean --force
RUN npm install

# Copie o restante da aplicação
COPY ./evio_OCPP_J_Microservice .

# (Opcional) Remova .npmrc após instalar dependências
RUN rm -f /root/.npmrc

EXPOSE 3018
EXPOSE 8090

CMD ["npm", "start"]