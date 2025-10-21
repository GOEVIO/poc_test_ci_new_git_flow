FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest

RUN apt-get update && apt-get install -y git

WORKDIR /usr/src/app

# Copie apenas arquivos de dependências e .npmrc para melhor cache
COPY ./reports/package*.json ./
COPY ./reports/.npmrc /root/.npmrc

# Instala dependências
RUN npm cache clean --force
RUN npm install

# Copie o restante da aplicação
COPY ./reports .

# Build da aplicação
RUN npm run build

# (Opcional) Remova .npmrc após instalar dependências
RUN rm -f /root/.npmrc

EXPOSE 3000

CMD ["npm", "start"]