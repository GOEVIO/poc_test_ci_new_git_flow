FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest

RUN apt-get update && apt-get install -y git && apt install -y python3 python3-pip

WORKDIR /usr/src/app

# Copia apenas arquivos de dependências e .npmrc para melhor cache
COPY ./evio_Configs_Microservice/package*.json ./
COPY ./evio_Configs_Microservice/.npmrc /root/.npmrc

# Instala dependências
RUN npm cache clean --force
RUN npm install

# Copia o restante da aplicação
COPY ./evio_Configs_Microservice .

# (Opcional) Remove .npmrc após build
RUN rm -f /root/.npmrc

EXPOSE 3028

CMD ["npm", "run", "start:prod"]

