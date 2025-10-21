FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest

RUN apt-get update && apt-get install -y git

WORKDIR /usr/src/app

# Copie apenas arquivos de dependências para melhor aproveitamento do cache
COPY ./evio_Tariffs_Microservice/package*.json ./
COPY ./evio_Tariffs_Microservice/.npmrc /root/.npmrc

# Instala dependências
RUN npm cache clean --force
RUN npm install

# Copie o restante da aplicação
COPY ./evio_Tariffs_Microservice .

# Build da aplicação
RUN npm run build

RUN rm -f /root/.npmrc

EXPOSE 3009

CMD ["npm", "start"]