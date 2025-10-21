FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest

WORKDIR /usr/src/app

# Copia apenas arquivos de dependências e .npmrc para melhor cache
COPY ./evio_Chargers_Microservice/package*.json ./
COPY ./evio_Chargers_Microservice/.npmrc /root/.npmrc

# Instala dependências
RUN npm cache clean --force
RUN npm install

# Copia o restante da aplicação
COPY ./evio_Chargers_Microservice .

# Build da aplicação
RUN npm run build

# (Opcional) Remove .npmrc após build
RUN rm -f /root/.npmrc

EXPOSE 3002

CMD ["npm", "run", "start:prod"]
