FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest
WORKDIR /usr/src/app
COPY . .
RUN npm install --maxsockets=1
EXPOSE 3021

#RUN mkdir -p /usr/src/app
#COPY package.json /usr/src/app/
#COPY . /usr/src/app
#CMD [ "npm", "start" ]