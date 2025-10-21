FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest
WORKDIR /usr/src/app
COPY . .
RUN npm cache clean --force
RUN npm install --force
EXPOSE 8087

