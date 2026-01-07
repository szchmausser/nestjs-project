import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from 'src/prisma/generated/prisma/client';
import { ExceptionResponse } from 'src/authentication/interfaces/exception-response.interface';
import { PrismaErrorMeta } from 'src/authentication/interfaces/prisma-errors-interface';

/**
 * FILTRO DE EXCEPCIONES GLOBAL: AllExceptionsFilter
 * Este filtro es la última línea de defensa. Atrapa cualquier error que los
 * controladores, guards o interceptores no hayan manejado.
 * Al estar vacío @Catch(), le indicamos que capture CUALQUIER tipo de excepción.
 */
@Catch()
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

    // 1. DETERMINAR EL CÓDIGO DE ESTADO Y MENSAJE (Variables de control)
    // Inicializamos con un error 500 y un mensaje genérico por seguridad.
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    // 2. ANÁLISIS DE LA EXCEPCIÓN SEGÚN SU ORIGEN

    // CASO A: Errores específicos de Prisma (Base de Datos)
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Delegamos la lógica compleja de traducción de códigos Prisma a un método especializado.
      const prismaError = this.handlePrismaError(exception);
      status = prismaError.status;
      message = prismaError.message;
    }
    // CASO B: Errores de validación de esquema de Prisma (Query mal formada)
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message =
        'Error de validación de datos en la persistencia (Esquema inválido).';
    }
    // CASO C: Errores de conexión/inicialización de Prisma
    else if (exception instanceof Prisma.PrismaClientInitializationError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'No se pudo establecer conexión con la base de datos.';
    }
    // CASO D: Excepciones estándar de NestJS (HttpException)
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      /**
       * NestJS puede responder con:
       * - Un objeto (DTO): { message: ["password is too short"], error: "Bad Request" }
       * - Un string: "Unauthorized"
       */
      if (typeof res === 'object' && res !== null) {
        // Usamos la interfaz ExceptionResponse para acceder a la propiedad .message de forma segura
        const formattedRes = res as ExceptionResponse;
        message = formattedRes.message;
      } else {
        message = String(res);
      }
    }
    // CASO E: Errores genéricos de JavaScript (SyntaxError, etc)
    else if (exception instanceof Error) {
      /**
       * Si el error es una instancia de Error nativa tomamos su propiedad .message descriptiva.
       */
      message = exception.message;
    }

    // 3. RESPUESTA FINAL ESTANDARIZADA
    /**
     * Es el espejo del ResponseInterceptor. El Frontend siempre recibirá esta estructura
     * si algo sale mal, facilitando el manejo de errores global.
     */
    response.status(status).json({
      success: false, // Identificador de fallo
      statusCode: status, // Código HTTP para lógica del cliente
      timestamp: new Date().toISOString(), // Momento exacto del error
      path: request.url, // Endpoint donde ocurrió el fallo
      message: message, // Explicación amigable o técnica del error
    });
  }

  /**
   * MÉTODO PRIVADO: handlePrismaError
   * Centraliza la lógica de extracción de mensajes para errores conocidos de Prisma.
   * Resuelve el problema de los Driver Adapters buscando profundamente en el objeto meta
   * para identificar qué campo o relación causó el conflicto.
   */
  private handlePrismaError(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
  } {
    const meta = exception.meta as PrismaErrorMeta | undefined;
    const model = meta?.modelName ? ` (${meta.modelName})` : '';

    /**
     * FUNCIÓN AUXILIAR: getFields
     * Intenta extraer los nombres de los campos de tres lugares posibles:
     * 1. meta.target (Estándar de Prisma)
     * 2. driverAdapterError (Ruta específica para Driver Adapters/SQLite)
     * 3. field_name (Errores de relación)
     */
    const getFields = (): string => {
      const rawFields =
        meta?.target ||
        meta?.driverAdapterError?.cause?.constraint?.fields ||
        meta?.field_name;

      if (Array.isArray(rawFields)) return rawFields.join(', ');
      return typeof rawFields === 'string' ? rawFields : 'campo';
    };

    switch (exception.code) {
      case 'P2002': // Unique constraint failed (Duplicados)
        return {
          status: HttpStatus.CONFLICT,
          message: `Ya existe un registro con este valor en el campo: ${getFields()}${model}.`,
        };
      case 'P2003': // Foreign key constraint failed (Relaciones)
        return {
          status: HttpStatus.BAD_REQUEST,
          message: `Error de referencia: El dato en '${getFields()}' no es válido en la relación${model}.`,
        };
      case 'P2005': // Invalid value for field
        return {
          status: HttpStatus.BAD_REQUEST,
          message: `El valor para '${getFields()}' es inválido para la base de datos${model}.`,
        };
      case 'P2006': // Invalid format for field
        return {
          status: HttpStatus.BAD_REQUEST,
          message: `El formato para '${getFields()}' es inválido para la base de datos${model}.`,
        };
      case 'P2025': {
        const resource = meta?.modelName || meta?.cause || 'recurso';
        return {
          status: HttpStatus.NOT_FOUND,
          message: `El ${resource} solicitado no existe o no fue encontrado.`,
        };
      }
      default:
        // Si el código no está mapeado, devolvemos un 400 genérico sin exponer detalles sensibles.
        return {
          status: HttpStatus.BAD_REQUEST,
          message: `Error de base de datos (Prisma Code: ${exception.code})`,
        };
    }
  }
}
