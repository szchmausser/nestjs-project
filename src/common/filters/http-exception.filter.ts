import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ExceptionResponse } from 'src/auth/interfaces/exception-response.interface';

/**
 * FILTRO DE EXCEPCIONES GLOBAL: AllExceptionsFilter
 * Este filtro es la última línea de defensa. Atrapa cualquier error que los
 * controladores, guards o interceptores no hayan manejado.
 */
@Catch() // Al estar vacío, le indicamos que capture CUALQUIER tipo de excepción.
export class AllExceptionsFilter implements ExceptionFilter {
  /**
   * MÉTODO CATCH
   * @param exception El objeto de error lanzado.
   * @param host El "contenedor" de la petición actual.
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    /**
     * CONTEXTO DE EJECUCIÓN:
     * .switchToHttp() -> Le dice a Nest: "Estoy trabajando en una API Web (HTTP)".
     * Esto nos permite obtener los objetos específicos de Express:
     * - Request: Para saber qué URL se llamó (path).
     * - Response: Para poder enviar el JSON de error manualmente.
     */
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 1. DETERMINAR EL CÓDIGO DE ESTADO (HTTP Status Code)
    // Si la excepción es de tipo HttpException (erorres controlados de Nest),
    // extraemos su código. Si es un error desconocido (ej: crash de lógica), asignamos 500.
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // 2. EXTRACCIÓN SEGURA DEL MENSAJE DE ERROR
    // Inicializamos con un mensaje genérico por seguridad (no filtrar info sensible).
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      // Obtenemos la respuesta que el error trae internamente
      const res = exception.getResponse();

      /**
       * NestJS puede responder con:
       * - Un string: "Unauthorized"
       * - Un objeto (DTO): { message: ["password is too short"], error: "Bad Request" }
       */
      if (typeof res === 'object' && res !== null) {
        // Usamos la interfaz ExceptionResponse para acceder a la propiedad .message de forma segura
        message = (res as ExceptionResponse).message;
      } else if (typeof res === 'string') {
        message = res;
      }
    } else if (exception instanceof Error) {
      /**
       * Si el error es una instancia de Error nativa (ej: Prisma, SyntaxError),
       * tomamos su propiedad .message descriptiva.
       */
      message = exception.message;
    }

    // 3. RESPUESTA FINAL ESTANDARIZADA
    // Es el espejo del ResponseInterceptor. El Frontend siempre recibirá esta estructura
    // si algo sale mal, facilitando el manejo de errores global.
    response.status(status).json({
      success: false, // Identificador de fallo
      statusCode: status, // Código HTTP para lógica del cliente
      timestamp: new Date().toISOString(), // Momento exacto del error
      path: request.url, // Endpoint donde ocurrió el fallo
      message: message, // Explicación amigable o técnica del error
    });
  }
}
