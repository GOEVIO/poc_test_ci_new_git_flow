FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest

RUN apt-get update && \
    apt-get install -y git python3 python3-distutils make g++ && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/local-npm-packages

# Instala e builda os pacotes locais em sequência
COPY ./local-npm-packages/evio-base-datasource ./evio-base-datasource
RUN cd evio-base-datasource && npm install  && npm run build

COPY ./local-npm-packages/evio-datasources ./evio-datasources
RUN cd evio-datasources && npm install && npm run build

COPY ./local-npm-packages/evio-services ./evio-services
RUN cd evio-services && npm install && npm run build

WORKDIR /usr/src/app

# Copia apenas arquivos de dependências e .npmrc para melhor cache
COPY ./evio_Identity_Microservice/package*.json ./
COPY ./evio_Identity_Microservice/.npmrc /root/.npmrc

# Instala dependências
RUN npm cache clean --force
RUN npm install

# Copia o restante da aplicação
COPY ./evio_Identity_Microservice .

RUN npm run build

COPY ./evio_Identity_Microservice/wsdl ./build/wsdl

RUN rm -f /root/.npmrc

EXPOSE 3003

CMD ["npm", "run", "start:prod"]