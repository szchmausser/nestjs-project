import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { response, type Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StandardResponse } from 'src/auth/interfaces/standard-response.interface';

/**
 * INTERFAZ: StandardResponse
 * Definimos la estructura global de éxito. Define el contrato de cómo se verá TODA
 * respuesta exitosa en nuestra API. Usamos un genérico <T> para que los datos (data)
 * puedan ser cualquier cosa.
 */

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  StandardResponse<T>
> {
  /**
   * MÉTODO INTERCEPT
   * Es el corazón del interceptor.
   * @param context Contiene información de la petición actual (HTTP, Request, etc.)
   * @param next Es un objeto que nos permite "dejar pasar" la petición hacia el controlador.
   */
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>, // 👈 Añadimos <T> aquí para que Nest sepa qué maneja el Handler
  ): Observable<StandardResponse<T>> {
    // 1. OBTENEMOS EL CONTEXTO:
    // Extraemos la información de la petición HTTP para saber, por ejemplo, la URL (path).
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const url = request.url;
    const statusCode = response.statusCode;

    /**
     * 2. EL FLUJO: next.handle()
     * Cuando llamamos a next.handle(), le decimos a Nest: "Ejecuta el controlador".
     * Esto nos devuelve un 'Observable', que es como una promesa pero más potente.
     * Usamos el operador '.pipe()' de RxJS para manipular el resultado que
     * el controlador está a punto de enviar.
     */
    return next.handle().pipe(
      /**
       * 3. TRANSFORMACIÓN: map()
       * Aquí es donde ocurre la magia. El parámetro 'data' es lo que tu controlador
       * devolvió originalmente (ej: el objeto usuario de Prisma).
       */
      map((data) => {
        // 4. CREAMOS EL NUEVO OBJETO:
        // Envolvemos los datos originales en nuestra estructura estándar.
        const finalResponse: StandardResponse<T> = {
          success: true, // Siempre true, porque este interceptor solo atrapa éxitos.
          statusCode: statusCode, // Código de estado HTTP dinámico (200, 201, etc.)
          timestamp: new Date().toISOString(), // Fecha exacta de la respuesta.
          path: url, // Qué endpoint se llamó.
          data: data, // Los datos originales que devolvió el controlador.
        };

        return finalResponse;
      }),
    );
  }
}
