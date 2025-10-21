FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest

RUN apt-get update && apt-get install -y git && apt install -y python3 python3-pip

WORKDIR /usr/src/app

# Copie apenas arquivos de dependências para melhor aproveitamento do cache
COPY ./evio_Billing_Microservice/package*.json ./
COPY ./evio_Billing_Microservice/.npmrc /root/.npmrc

RUN npm install

# Copie o restante da aplicação
COPY ./evio_Billing_Microservice .

# (Opcional) Remova o .npmrc após instalar dependências
RUN rm -f /root/.npmrc

EXPOSE 3030

CMD ["npm", "start"]