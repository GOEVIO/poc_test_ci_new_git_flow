import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
// import * as fs from 'fs'

export const configSwagger = (app: NestFastifyApplication) => {
  const config = new DocumentBuilder()
    .setTitle("EVIO APT Microservice API's")
    .setDescription('APIs for the EVIO APT Microservice')
    .setVersion('1.0')
    .addTag('APT')
    .addTag('Charger')
    .addTag('Charging Session')
    .addTag('Payments')
    .addTag('Plugs-Tariffs')
    .build()
  const documentFactory = () => SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/private/apt-docs', app, documentFactory)

  // Create a swagger.json file
  // fs.writeFileSync('./swagger.json', JSON.stringify(documentFactory(), null, 2))
}
