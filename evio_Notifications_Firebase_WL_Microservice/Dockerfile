FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest

RUN apt-get update && apt-get install -y git && apt install -y python3 python3-pip

WORKDIR /usr/src/app

# Copia apenas arquivos de dependências e .npmrc para melhor cache
COPY ./evio_Notifications_Firebase_WL_Microservice/package*.json ./
COPY ./evio_Notifications_Firebase_WL_Microservice/.npmrc /root/.npmrc

# Instala dependências
RUN npm cache clean --force
RUN npm install --force

# Copia o restante da aplicação
COPY ./evio_Notifications_Firebase_WL_Microservice .

# (Opcional) Remove .npmrc após build
RUN rm -f /root/.npmrc

EXPOSE 3032

CMD ["npm", "run", "start:prod"]
