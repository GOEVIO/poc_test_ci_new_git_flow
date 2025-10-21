FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node22:14.0

RUN apt-get update && apt-get install -y git

WORKDIR /usr/src/

# Copia apenas arquivos de dependências e .npmrc para melhor cache
COPY ./evio_Payments_Microservice/package*.json ./
COPY ./evio_Payments_Microservice/.npmrc /root/.npmrc

# Instala dependências
RUN npm cache clean --force
RUN npm install

# Copia o restante da aplicação
COPY ./evio_Payments_Microservice .

# (Opcional) Remove .npmrc após build
RUN rm -f /root/.npmrc

EXPOSE 3017

CMD ["npm", "run", "start:prod"]