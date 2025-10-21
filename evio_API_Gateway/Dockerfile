FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest

WORKDIR /usr/src/app

# Copy only dependency files to make better use of the cache
COPY ./evio_API_Gateway/package*.json ./
COPY ./evio_API_Gateway/.npmrc /root/.npmrc

RUN npm install

# Copy the rest of the application
COPY ./evio_API_Gateway .

# (Optional) Remove the .npmrc after installing dependencies
RUN rm -f /root/.npmrc

EXPOSE 3000

CMD ["npm", "start"]