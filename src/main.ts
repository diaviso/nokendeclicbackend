import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Les fichiers utilisateurs sont servis par Cloudflare R2, plus depuis le
  // disque local : celui-ci est réinitialisé à chaque déploiement Railway.

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS - Support multiple origins for production
  const frontendUrl = configService.get<string>('frontend.url');
  const corsOrigins = frontendUrl ? frontendUrl.split(',').map(url => url.trim()) : ['http://localhost:5173'];
  
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Noken Declic API')
    .setDescription('API de la plateforme Noken Declic - Emploi, Formations, Bourses')
    .setVersion('2.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Start - Railway uses PORT env variable
  const port = process.env.PORT || configService.get<number>('port') || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Noken Declic API running on port ${port}`);
  console.log(`📚 Swagger docs available at /api/docs`);
}
bootstrap();
