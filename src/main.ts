import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'; // 1. Import
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json(),
          ),
        }),
        new winston.transports.File({
          filename: 'app_activity.log',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json(),
          ),
        }),
      ],
    }),
  });

  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

// 2. Setup the "Config" (The meta-data for your docs)
  const config = new DocumentBuilder()
    .setTitle('My Cool API')
    .setDescription('The API description')
    .setVersion('1.0')
    .build();

  // 3. Create the document and setup the path
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document); // This sets the URL to /docs
  
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(`Listening on http://localhost:${port}`, 'Bootstrap');
}
bootstrap();
