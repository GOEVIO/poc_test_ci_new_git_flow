import * as fs from 'fs';
import path from 'path';
import mqtt from 'mqtt';
import env from '../configuration/index';
import smartBoxSubscriptionHandler from '../controllers/smartBoxSubscriptionsController';
import cron from 'node-cron';
import { captureException, captureMessage } from '@sentry/node';
// BD
import { getMQTTControllers, getControllerById } from '../utils/controllersQueries';
import { ObjectId } from 'mongoose';
// Controllers
import controllerController from './controllerController';
import startController from './startMicroserviceController';
// interfaces
import { ICacheObject } from '../interfaces/cacheInterface';
import { DBControllerInterface } from '../interfaces/controllersInterfaces';
import { IPublishMessageType } from '../interfaces/mqttSubscriptionsInterfaces';
import cacheController from './cacheController';
// Services
import A8000Subscriptions from '../services/A8000Subscriptions';

const commonLog = '[ handler mqtt ';
let client: mqtt.MqttClient;

async function createClient(): Promise<boolean> {
    const context = `${commonLog} createClient ]`;
    try {
        let failConnectionsCounter = 0;
        // Esta forma de ligação vai ser só usada durante o desenvolvimento, a forma como se vai ligar ao broker vai ser diferente
        // nas reviews ignorar este objeto brokerOptions
        const brokerOptions: mqtt.IClientOptions = {
            // clientId: 'your-client-id',
            host: env.MQTT.BROKER_URL,
            port: env.MQTT.BROKER_PORT,
            protocol: 'mqtts', // Use MQTT over TLS
            protocolId: 'MQTT',
            protocolVersion: 4,
            rejectUnauthorized: false, // Set to true if your broker uses a self-signed certificate
            ca: [fs.readFileSync(path.join(__dirname, '..', '..', 'ssl', `rootCA.crt`))],
            key: [fs.readFileSync(path.join(__dirname, '..', '..', 'ssl', `client.key`))],
            cert: [fs.readFileSync(path.join(__dirname, '..', '..', 'ssl', `client.crt`))],
            username: env.MQTT.BROKER_USERNAME,
            password: env.MQTT.BROKER_PASSWORD,
        };
        let newConnection = true;
        // create connection
        client = await mqtt.connect(brokerOptions);
        client.on('connect', async () => {
            console.log('Connected to MQTT broker ---');
            failConnectionsCounter = 0;
            if (newConnection) {
                if (!(await createStartSubscriptions())) {
                    console.error(`${context} Error - Error creating subscriptions to MQTT controller`);
                    throw new Error('Error creating subscriptions to MQTT controller');
                }
                newConnection = false;
                console.log(`${context}  - All subscriptions from MQTT controllers are done ... `);
            }
        });

        // Event handling when a message is received
        client.on('message', (topic, message) => {
            // smartBox_v1 topics
            if (topic.startsWith('controllers/'))
                smartBoxSubscriptionHandler.subscribeTopicHandle(topic, message).catch((error) => {
                    reportSubscriptionError(error, topic, message, env.CONTROLLER.MODELS.MODEL_SMARTBOX_V1);
                });
            if (topic.startsWith('Controller/A8000/')) {
                //Siemens A8000 topics
                A8000Subscriptions.subscriptionHandler(topic, message).catch((error) => {
                    reportSubscriptionError(error, topic, message, env.CONTROLLER.MODELS.MODEL_SIEMENS_A8000);
                });
            } else {
                console.log(`Received message on topic '${topic}': ${message.toString()}`);
            }
        });

        // Event handling when the client disconnects
        client.on('close', async () => {
            console.log('Disconnected from MQTT broker');
            failConnectionsCounter++;
            if (failConnectionsCounter === 1 || failConnectionsCounter % 300 === 0) captureMessage('MQTT Connection was lost with the MQTT Broker');

            if (failConnectionsCounter === 1) await startController.sendStartOffline();
        });

        // Handle errors
        client.on('error', async (error) => {
            console.error(`${context} MQTT error - ${error}`);
            failConnectionsCounter++;
            if (failConnectionsCounter === 1 || failConnectionsCounter % 300 === 0)captureException(`Error connecting with the MQTT Broker ${error.message}`);

            if (failConnectionsCounter === 1) await startController.sendStartOffline();

        });
        return true;
    } catch (error) {
        console.error(`${context} Error - ${error.message}`);
        throw error;
    }
}

async function createStartSubscriptions() {
    const context = `${commonLog} createStartSubscriptions ]`;
    try {
        const listDevices = await getMQTTControllers();
        if (listDevices.length < 1) {
            console.log(`${context}  - No MQTT devices to subscribe ...`);
            return true;
        }
        if (!(await createSubscriptionsToController(listDevices))) {
            console.log(`${context} Error - Fail to create MQTT Subscriptions`);
            throw new Error('Fail to create MQTT Subscriptions');
        }
        return true;
    } catch (error) {
        console.error(`${context} Error - ${error.message}`);
        throw error;
    }
}

async function startMQTT(): Promise<boolean> {
    const context = `${commonLog} startMQTT ]`;
    try {
        console.log(`${context} Start connection to MQTT Broker`);
        const clientCreated = await createClient();
        if (!clientCreated) {
            console.error(`${context} createClient Error - Fail to connect to MQTT Broker`);
            throw new Error('Fail to connect to MQTT Broker');
        }
        // create cron of online status check
        startCronOnlineStatus();
        return true;
    } catch (error) {
        console.error(`${context} Error - ${error.message}`);
        throw error;
    }
}

async function createSubscriptionsToController(arrayControllers: DBControllerInterface[]): Promise<boolean> {
    const context = `${commonLog} createSubscriptionsToController ]`;
    try {
        if (!arrayControllers) {
            console.error(`${context} Error - Missing input controller `, arrayControllers);
            throw new Error(`Missing input controller`);
        }
        if (!client?.connected) {
            console.error(`${context} Error - MQTT Client is not connected`);
            // new subscription but the client is not connected or is temporary disconnected
            throw new Error(`MQTT Client is not connected`);
        }
        let subscriptionTopics: string[] = [];
        let cmdToPublish: IPublishMessageType[] = []; // need to send Refresh to receive info from new devices
        for (let controller of arrayControllers) {
            switch (controller.model) {
                case env.CONTROLLER.MODELS.MODEL_SMARTBOX_V1:
                    //subscriptionTopics.push(`controllers/${controller.deviceId}/#`);
                    subscriptionTopics.push(`controllers/${controller.deviceId}/devices/+/info`);
                    subscriptionTopics.push(`controllers/${controller.deviceId}/identifier`);
                    subscriptionTopics.push(`controllers/${controller.deviceId}/keepAlive`);
                    subscriptionTopics.push(`controllers/${controller.deviceId}/strategies/list`);
                    cmdToPublish.push({ topic: `controllers/${controller.deviceId}/commands/refresh`, message: '' });
                    break;
                case env.CONTROLLER.MODELS.MODEL_SIEMENS_A8000:
                    subscriptionTopics.push(`Controller/A8000/${controller.deviceId}/+/MES/#`);
                    subscriptionTopics.push(`Controller/A8000/${controller.deviceId}/+/STA/#`);
                    break;
                default:
                    console.error(`${context} Error - Unknown model type: ${controller.model} for MQTT protocol`);
                    throw new Error(`Unknown model type: ${controller.model} for MQTT protocol`);
                    break;
            }
        }
        if (subscriptionTopics?.length < 1) {
            console.log(`${context} No controller to subscribe`);
            return true;
        }
        const newSub = await client.subscribeAsync(subscriptionTopics, { qos: 1 });
        if (cmdToPublish.length > 0) await publishTopics(cmdToPublish);

        return newSub ? true : false;
    } catch (error) {
        console.error(`${context} Error - ${error.message}`);
        throw error;
    }
}

async function unsubscribeControllers(arrayControllers: DBControllerInterface[]): Promise<boolean> {
    const context = `${commonLog} unsubscribeControllers]`;
    try {
        if (!arrayControllers || arrayControllers.length < 1) {
            console.error(`${context} Error - Missing input Controllers `, arrayControllers);
            throw new Error('Missing input Controllers');
        }
        if (!client?.connected) {
            console.error(`${context} Error - MQTT client not connected to Broker`);
            throw new Error('MQTT client not connected to Broker');
        }

        let arrayUnsubscribeTopics: string[] = [];
        for (let device of arrayControllers) {
            switch (device.model) {
                case 'smartBox_v1':
                    arrayUnsubscribeTopics.push(`controllers/${device.deviceId}/#`);
                    arrayUnsubscribeTopics.push(`controllers/${device.deviceId}/devices/+/info`);
                    break;

                default:
                    break;
            }
        }
        if (arrayUnsubscribeTopics.length > 0) {
            await client.unsubscribeAsync(arrayUnsubscribeTopics);
        }
        return true;
    } catch (error) {
        console.error(`${context} Error - ${error.message}`);
        throw error;
    }
}

async function publishTopics(publishTopics: IPublishMessageType[]): Promise<boolean> {
    const context = `${commonLog} publishTopics]`;
    try {
        if (publishTopics.length < 1) {
            console.error(`${context} Error - Missing publishTopics `, publishTopics);
            throw new Error('Missing publishTopics');
        }
        for (let topic of publishTopics) {
            await client.publishAsync(topic.topic, topic.message);
        }
        return true;
    } catch (error) {
        console.error(`${context} Error - ${error.message}`);
        throw error;
    }
}

async function unsubscribeTopics(arrayTopics: string[]): Promise<boolean> {
    const context = `${commonLog} unsubscribeTopics]`;
    try {
        if (arrayTopics.length < 1) return true;

        if (!client?.connected) {
            console.error(`${context} Error - MQTT client not connected to Broker`);
            throw new Error('MQTT client not connected to Broker');
        }
        await client.unsubscribeAsync(arrayTopics);
        return true;
    } catch (error) {
        console.error(`${context} Error - ${error.message}`);
        throw error;
    }
}

async function subscribeTopics(arrayTopics: string[]): Promise<boolean> {
    const context = `${commonLog} subscribeTopics]`;
    try {
        if (arrayTopics.length < 1) return true;

        await client.subscribeAsync(arrayTopics);
        return true;
    } catch (error) {
        console.error(`${context} Error - ${error.message}`);
        throw error;
    }
}

async function addNewSubscriptions(arrayTopics: string[], controllerId: ObjectId): Promise<boolean> {
    const context = `${commonLog} addNewSubscriptions]`;
    try {
        if (!arrayTopics || !controllerId) {
            console.error(`${context} Error - Missing input data ${arrayTopics} ${controllerId}`);
            throw new Error('Missing input data');
        }
        if (!client.connected) {
            console.error(`${context} Error - MQTT Client is not connected`);
            // new subscription but the client is not connected or is temporary disconnected
            throw new Error(`MQTT Client is not connected`);
        }
        const controller = await getControllerById(controllerId);
        if (!controller) {
            console.error(`${context} Error - Controller doesn't exit for this id ${controllerId}`);
            throw new Error(`Controller doesn't exit for this id ${controllerId}`);
        }
        for (const subscribeTopic of arrayTopics) {
            await client.subscribeAsync(subscribeTopic, { qos: 1 });
        }
        return true;
    } catch (error) {
        console.error(`${context} Error - ${error.message}`);
        throw error;
    }
}

// this cron will be checking if some device stopped updating us for a defined period of time
function startCronOnlineStatus(): boolean {
    const context = `${commonLog} startCronOnlineStatus]`;
    const ONE_SECOND = 1000; // constant to convert milliseconds to seconds
    cron.schedule(env.MQTT.CRON_ONLINE_STATUS, () => {
        const cacheObjects = cacheController.getAllCacheKeys();
        if (!cacheObjects) return null;
        const currentDate = new Date().getTime();
        const arrayUpdateDevices: string[] = [];
        Object.entries(cacheObjects).forEach(([key, value]) => {
            const valueObject = value as unknown as ICacheObject;
            if (!valueObject.online || !valueObject.lastChanged) return;

            if ((currentDate - new Date(valueObject.lastChanged).getTime()) / ONE_SECOND >= env.MQTT.OFFLINE_TIME)
                arrayUpdateDevices.push(String(valueObject.controllerId));
        });
        if (arrayUpdateDevices.length > 0) controllerController.updateControllersConnectionStatus(arrayUpdateDevices, false);
    });

    return true;
}

function reportSubscriptionError(error: Error, topic: string, message: Buffer, device: string): void {
    const context = `${commonLog} reportSubscriptionError]`;
    console.error(`${context} subscribeTopicHandle error - ${error} device: ${device}`);
    console.error(`${context} subscribeTopicHandle error - ${topic} ${message.toString()}`);
    captureException(`Error on ${device} Subscription ${topic} `);
}

export default {
    startMQTT,
    createSubscriptionsToController,
    unsubscribeControllers,
    addNewSubscriptions,
    unsubscribeTopics,
    subscribeTopics,
    publishTopics,
};
