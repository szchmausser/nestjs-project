/**
 * ============================================================================
 * @file request-with-user.interface.ts
 * @description Extensión del objeto Request de Express para soporte de tipos.
 * @module PermissionModule
 * ============================================================================
 *
 * MEMORIA TÉCNICA
 * ===============
 *
 * Esta interfaz es una pieza clave en la integración de Express con NestJS
 * para los procesos de autorización.
 *
 * ¿POR QUÉ ES NECESARIA?
 * 1. EXTENSIÓN DE TIPOS: Por defecto, 'Request' de Express no conoce la
 *    propiedad 'user'. Esta propiedad es inyectada dinámicamente por @nestjs/passport
 *    tras la validación del JWT.
 *
 * 2. SEGURIDAD DE TIPADO: Sin esta interfaz, el acceso a 'request.user'
 *    obligaría al uso de 'any', lo que anularía los beneficios de TypeScript.
 *
 * 3. CONSISTENCIA: Asegura que el usuario inyectado en la request sea
 *    siempre tratado como un 'JwtPayload', facilitando el flujo hacia los
 *    servicios de permisos que dependen de esta identidad.
 *
 * RELACIÓN CON PASSPORT:
 * NestJS Passport inyecta el resultado de validate() en request.user.
 * Esta interfaz asegura que esa inyección sea transparente y segura para los Guards.
 *
 * ============================================================================
 */

import { JwtPayload } from './jwt-payload.interface';

/**
 * RequestWithUser
 * ===============
 *
 * Representa un objeto Request de Express que garantiza la existencia
 * de un usuario autenticado y tipado.
 */
export interface RequestWithUser extends Request {
  /**
   * Usuario decodificado desde el JWT.
   * Inyectado por JwtAuthGuard.
   */
  user?: JwtPayload;
}
