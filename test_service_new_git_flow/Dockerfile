FROM 348090157910.dkr.ecr.eu-west-1.amazonaws.com/node20lts:latest

WORKDIR /usr/src/app

# Copy only dependency files to make better use of the cache
COPY ./test_service_new_git_flow/package*.json ./
COPY ./test_service_new_git_flow/.npmrc /root/.npmrc

RUN npm install

# Copy the rest of the application
COPY ./evio_APItest_service_new_git_flow_Gateway .

RUN npm run build

# (Optional) Remove the .npmrc after installing dependencies
RUN rm -f /root/.npmrc

EXPOSE 9060

CMD ["npm", "start"]