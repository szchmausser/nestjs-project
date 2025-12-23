import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { UserPayload } from 'src/auth/interfaces/user-payload.interface';

/**
 * DECORADOR: @CurrentUser
 * Decorador personalizado para extraer el usuario de la petición.
 * NestJS nos permite "mapear" el objeto Request y devolver solo lo que nos interesa.
 * ¿POR QUÉ EXISTE?:
 * NestJS inyecta por defecto el usuario validado en el objeto 'Request' (req.user)
 * a través de Passport. Este decorador actúa como un "extractor" limpio para no
 * tener que importar todo el objeto Request en nuestros controladores.
 */
export const CurrentUser = createParamDecorator(
  /**
   * @param data Permite pasar argumentos al decorador (ej: @CurrentUser('email')).
   * En este caso no lo usamos, por eso es 'unknown'.
   * @param ctx  El ExecutionContext nos da acceso a la petición actual,
   * sin importar si es HTTP, WebSockets o Microservicios.
   */
  /**
   * Cambiamos el tipo de retorno a 'any' o usamos una unión de tipos.
   * En decoradores de parámetros, 'any' es aceptable porque el tipado real
   * se define en el controlador cuando haces: (user: UserPayload).
   */
  (data: keyof UserPayload | undefined, ctx: ExecutionContext) => {
    /**
     * 1. CONTEXTO: Convertimos el contexto genérico a uno específico de HTTP.
     * Esto nos permite acceder a los métodos de Express (getReq, getRes).
     */
    const httpContext = ctx.switchToHttp();

    /**
     * 2. PETICIÓN: Obtenemos el objeto Request de Express.
     * Tipamos como 'Request' para que TypeScript sepa que estamos en un entorno web.
     */
    const request = httpContext.getRequest<Request>();

    /**
     * 3. EXTRACCIÓN: Passport.js, después de validar el JWT en 'JwtStrategy',
     * guarda el resultado del método validate() dentro de 'request.user'.
     * Extraemos el usuario que Passport inyectó
     */
    const user = request.user as UserPayload | undefined;

    /**
     * 4. LÓGICA DE RETORNO:
     * El decorador permite dos usos:
     * A. @CurrentUser() -> Retorna el objeto usuario completo.
     * B. @CurrentUser('email') -> Retorna solo una propiedad específica.
     */

    // Caso A: Sin argumentos, entregamos el objeto completo. Si no hay 'data', devolvemos el usuario completo.
    // Si no se pasó ningún argumento al decorador (data es undefined)
    if (!data) {
      return user;
    }

    // Caso B: Si hay 'data' (ej: @CurrentUser('email')), extraemos solo esa propiedad.
    if (data) {
      // 1. Si no hay usuario (ej: ruta pública), devolvemos undefined de inmediato.
      if (!user) {
        return undefined;
      }

      // 2. Si el usuario existe, extraemos la propiedad solicitada. Ejemplo: user['email'] o user['id']
      const value = user[data];

      return value;
    }

    // Caso por defecto (aunque el 'if (!data)' de arriba ya lo cubre, dejamos un retorno de seguridad).
    return undefined;
  },
);
