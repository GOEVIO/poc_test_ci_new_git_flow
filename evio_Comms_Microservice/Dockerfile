FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest

RUN apt-get update && apt-get install -y git && apt install -y python3 python3-pip

WORKDIR /usr/src/app

# Copie apenas arquivos de dependências para melhor aproveitamento do cache
COPY package*.json ./
COPY .npmrc /root/.npmrc

# Instala dependências
RUN npm cache clean --force
RUN npm install

# Copie o restante da aplicação
COPY . .

# Build da aplicação
RUN npm run build

# (Opcional) Remove .npmrc após build
RUN rm -f /root/.npmrc

EXPOSE 3036

CMD ["npm", "run", "start:prod"]