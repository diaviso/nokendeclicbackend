import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Erreur interne du serveur';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : ((exceptionResponse as Record<string, any>).message as string) ||
            exception.message;
    } else if (
      // Les erreurs d'analyse du corps (body-parser) portent leur propre
      // statut sans être des HttpException. Sans ce rattrapage, un corps trop
      // volumineux ou un JSON mal formé se présentait comme une « erreur
      // interne », ce qui envoie chercher la panne côté serveur alors que la
      // requête est simplement à corriger.
      typeof (exception as { status?: unknown })?.status === 'number' &&
      (exception as { status: number }).status >= 400 &&
      (exception as { status: number }).status < 500
    ) {
      status = (exception as { status: number }).status;
      message =
        status === HttpStatus.PAYLOAD_TOO_LARGE
          ? 'Contenu trop volumineux. Allégez le texte ou retirez des images.'
          : ((exception as { message?: string }).message ?? 'Requête invalide');
    }

    // Identifiant de corrélation : renvoyé au client ET journalisé, pour pouvoir
    // relier un signalement utilisateur à la trace serveur correspondante.
    const correlationId = randomUUID();
    const userId = (request as any).user?.id ?? 'anonyme';
    const context = `${request.method} ${request.originalUrl} | user=${userId} | id=${correlationId}`;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // 5xx : anomalie serveur, on veut la trace complète.
      this.logger.error(
        `${context} | ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
      // Utile pour détecter les tentatives d'accès non autorisées répétées.
      this.logger.warn(`${context} | ${status} ${JSON.stringify(message)}`);
    } else {
      this.logger.debug?.(`${context} | ${status}`);
    }

    response.status(status).json({
      statusCode: status,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }
}
