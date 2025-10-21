FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest

RUN apt-get update && apt-get install -y python3 python3-pip

WORKDIR /usr/src/app
COPY . .
RUN npm install
RUN npm run build
EXPOSE 3001


