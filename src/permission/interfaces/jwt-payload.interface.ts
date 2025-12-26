/**
 * ============================================================================
 * @file jwt-payload.interface.ts
 * @description Interfaz que define la estructura del token JWT decodificado.
 * @module PermissionModule
 * ============================================================================
 *
 * MEMORIA TÉCNICA
 * ===============
 *
 * Esta interfaz actúa como el puente fundamental entre el sistema de
 * autenticación (Passport/JWT) y el sistema de autorización (CASL/Prisma).
 *
 * ¿POR QUÉ ES NECESARIA?
 * 1. DESACOPLAMIENTO: Permite que el sistema de permisos trabaje con una
 *    versión ligera del usuario sin depender de la entidad User completa
 *    de la base de datos para verificaciones preliminares.
 *
 * 2. SEGURIDAD: Define exactamente qué datos están disponibles en el token.
 *    Al ser inyectado por el JwtAuthGuard, este objeto es la única fuente de
 *    verdad sobre la identidad del usuario durante el pipeline de la request.
 *
 * 3. TIPADO: Elimina el uso de 'any' en los Guards, proporcionando
 *    autocompletado y validación en tiempo de compilación.
 *
 * RELACIÓN CON PASSPORT:
 * El payload aquí definido debe coincidir con el retorno del método
 * validate() en la estrategia JWT (JwtStrategy).
 *
 * ============================================================================
 */

/**
 * JwtPayload
 * ==========
 *
 * Representa los datos del usuario extraídos y decodificados del JWT.
 */
export interface JwtPayload {
  /**
   * ID único del usuario.
   * Usado para cargar los permisos completos desde la base de datos
   * y para evaluaciones ABAC (ej: { authorId: userId }).
   */
  id: number;

  /**
   * Email del usuario.
   * Utilizado principalmente para logs y auditoría dentro de los Guards.
   */
  email: string;

  /**
   * Issued At (iat)
   * Timestamp (Unix) de cuándo se generó el token.
   */
  iat?: number;

  /**
   * Expiration Time (exp)
   * Timestamp (Unix) de cuándo expira el token.
   */
  exp?: number;
}
