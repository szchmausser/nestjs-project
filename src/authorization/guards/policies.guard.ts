/**
 * ============================================================================
 * @file policies.guard.ts
 * @description Guard de NestJS que evalúa políticas de autorización CASL.
 * @module AuthorizationModule
 * ============================================================================
 *
 * MEMORIA TÉCNICA
 * ===============
 *
 * Este archivo implementa el PoliciesGuard, un guardia de NestJS que actúa
 * como "portero" para endpoints protegidos por políticas de autorización.
 *
 * RESPONSABILIDAD ÚNICA:
 * Verificar que el usuario autenticado cumple con las políticas declaradas
 * en el decorador @CheckPolicies() del endpoint.
 *
 * POSICIÓN EN EL PIPELINE DE REQUEST:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Request HTTP                                                           │
 * │     ↓                                                                  │
 * │ JwtAuthGuard (Global) → Valida JWT, inyecta user en request            │
 * │     ↓                                                                  │
 * │ PoliciesGuard (Por endpoint) → Verifica permisos del usuario           │
 * │     ↓                                                                  │
 * │ Controller Handler → Ejecuta la lógica del endpoint                    │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * DIFERENCIA CON JwtAuthGuard:
 * - JwtAuthGuard: Responde "¿Quién eres?" (Autenticación)
 * - PoliciesGuard: Responde "¿Puedes hacer esto?" (Autorización)
 *
 * PATRÓN DE DISEÑO: Guard Pattern
 * Los Guards en NestJS implementan CanActivate y deciden si una request
 * puede proceder. Si retorna false o lanza excepción, NestJS bloquea la request.
 *
 * ============================================================================
 */

// ============================================================================
// IMPORTS - NestJS Core
// ============================================================================

/**
 * CanActivate:
 * Interfaz que debe implementar todo Guard de NestJS.
 * Define el contrato: método canActivate() que retorna boolean o Promise<boolean>.
 *
 * ExecutionContext:
 * Wrapper que provee acceso al contexto de ejecución actual.
 * Permite obtener el request HTTP, el handler del controller, y metadata.
 * Es agnóstico al protocolo (funciona para HTTP, WebSocket, gRPC, etc).
 *
 * Injectable:
 * Decorador que marca la clase como inyectable en el contenedor IoC de NestJS.
 * Permite que el Guard reciba dependencias en su constructor.
 *
 * ForbiddenException:
 * Excepción HTTP que genera respuesta 403 Forbidden.
 * Se lanza cuando el usuario está autenticado pero no tiene permiso.
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Reflector:
 * Utilidad de NestJS para leer metadata almacenado por decoradores.
 *
 * ¿CÓMO FUNCIONA?:
 * Los decoradores almacenan datos usando Reflect.defineMetadata().
 * Reflector.get(key, target) recupera esos datos.
 *
 * EN ESTE GUARD:
 * Usamos Reflector para extraer los PolicyHandlers almacenados
 * por el decorador @CheckPolicies() en el handler del controller.
 */
import { Reflector } from '@nestjs/core';

// ============================================================================
// IMPORTS - Módulo de Permisos
// ============================================================================

/**
 * CaslAbilityFactory:
 * Fábrica que construye instancias de AppAbility para cada usuario.
 * Ver casl-ability.factory.ts para documentación detallada.
 */
import { CaslAbilityFactory, AppAbility } from '../casl/casl-ability.factory';

/**
 * AuthorizationService:
 * Servicio que carga usuarios con su jerarquía completa de permisos.
 * Ejecuta el query a Prisma con los includes necesarios.
 */
import { AuthorizationService } from '../authorization.service';

/**
 * CHECK_POLICIES_KEY:
 * Clave de metadata usada por @CheckPolicies para almacenar handlers.
 * Debe coincidir con la usada en el decorador.
 */
import { CHECK_POLICIES_KEY } from '../decorators/check-policies.decorator';

/**
 * PolicyHandler:
 * Tipo unión para handlers de políticas (funciones o clases).
 */
import { PolicyHandler } from '../interfaces/policy-handler.interface';

/**
 * RequestWithUser:
 * Estructura de la request de Express extendida para incluir el usuario.
 * Se importa de forma independiente para mantener la coherencia con
 * el principio de responsabilidad única (Single Responsibility Principle).
 */
import { RequestWithUser } from '../interfaces/request-with-user.interface';

/**
 * JwtPayload:
 * Estructura del payload decodificado del token.
 * Se necesita aquí para tipar correctamente variables locales de tipo user.
 */
import { UserPayload } from '../../authentication/interfaces/user-payload.interface';

// ============================================================================
// GUARD: PoliciesGuard
// ============================================================================

/**
 * PoliciesGuard
 * =============
 *
 * Guard que evalúa políticas de autorización basadas en CASL.
 *
 * FLUJO DE EJECUCIÓN:
 * 1. Extrae los PolicyHandlers del metadata del endpoint.
 * 2. Obtiene el usuario del request (inyectado por JwtAuthGuard).
 * 3. Carga los permisos completos del usuario desde la DB.
 * 4. Construye el objeto Ability usando CaslAbilityFactory.createAbility().
 * 5. Ejecuta cada PolicyHandler con el Ability.
 * 6. Si TODOS retornan true → Permite acceso.
 * 7. Si ALGUNO retorna false → Lanza ForbiddenException.
 *
 * USO EN CONTROLLERS:
 * ```typescript
 * @Get('protected-endpoint')
 * @UseGuards(PoliciesGuard)
 * @CheckPolicies((ability) => ability.can('read', 'Post'))
 * async getProtectedData() { ... }
 * ```
 *
 * DEPENDENCIAS INYECTADAS:
 * - Reflector: Para leer metadata de @CheckPolicies
 * - CaslAbilityFactory: Para construir Abilities
 * - PermissionService: Para cargar permisos del usuario
 */
@Injectable()
export class PoliciesGuard implements CanActivate {
  /**
   * Constructor con inyección de dependencias.
   *
   * @param reflector - Utilidad de NestJS para leer metadata de decoradores.
   * @param caslAbilityFactory - Fábrica para crear instancias de Ability.
   * @param authorizationService - Servicio para cargar permisos de usuarios.
   */
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
    private authorizationService: AuthorizationService,
  ) {}

  /**
   * canActivate
   * ===========
   *
   * Método principal del Guard. Determina si la request puede proceder.
   *
   * @param context - ExecutionContext con acceso al request y handler.
   * @returns Promise<boolean> - true si el acceso es permitido.
   * @throws ForbiddenException - Si el usuario no cumple las políticas.
   *
   * IMPLEMENTACIÓN PASO A PASO:
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ========================================================================
    // PASO 1: Extraer PolicyHandlers del metadata
    // ========================================================================
    /**
     * Usamos Reflector para obtener los handlers almacenados por @CheckPolicies.
     *
     * context.getHandler() retorna el método del controller decorado.
     * El metadata está asociado a ese método específico.
     *
     * Si no hay @CheckPolicies, retorna undefined → usamos [] como default.
     */
    const policyHandlers =
      this.reflector.get<PolicyHandler[]>(
        CHECK_POLICIES_KEY,
        context.getHandler(),
      ) || [];

    // ========================================================================
    // PASO 2: Obtener usuario del request
    // ========================================================================
    /**
     * El JwtAuthGuard (ejecutado antes) validó el JWT y añadió el payload
     * decodificado a request.user.
     *
     * userPayload contiene datos mínimos: { id, email, iat, exp }
     * NO contiene los permisos completos (solo viene del JWT).
     */
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    /**
     * EXTRACCIÓN DEL USUARIO:
     * El JwtAuthGuard ha inyectado el payload decodificado en la request.
     * Usamos el tipo JwtPayload para garantizar que 'id' y 'email' están presentes.
     */
    const userPayload: UserPayload | undefined = request.user;

    /**
     * Guard: Si no hay usuario, denegar acceso.
     * Esto ocurre si JwtAuthGuard no se ejecutó o el token era inválido.
     */
    if (!userPayload) return false;

    // ========================================================================
    // PASO 3: Cargar permisos completos del usuario
    // ========================================================================
    /**
     * El JWT solo contiene id y email. Los permisos están en la DB.
     * Debemos cargar el usuario con toda su jerarquía de permisos:
     * - Roles asignados y sus permisos
     * - Permisos directos (grants y revokes)
     *
     * AuthorizationService.getUserWithPermissions() hace un query optimizado
     * con múltiples includes para traer toda la estructura.
     */
    const user = await this.authorizationService.getUserWithPermissions(
      userPayload.id,
    );

    /**
     * Guard: Si el usuario no existe o está inactivo, denegar.
     * El servicio ya filtra por isActive: true y deletedAt: null.
     */
    if (!user) return false;

    // ========================================================================
    // PASO 4: Construir Ability con CaslAbilityFactory
    // ========================================================================
    /**
     * CaslAbilityFactory.createAbility() construye un objeto Ability
     * con todas las reglas del usuario (roles + grants + revokes).
     *
     * El Ability resultante expone métodos:
     * - ability.can(action, subject): Verifica permiso positivo
     * - ability.cannot(action, subject): Verifica permiso negativo
     */
    const ability = this.caslAbilityFactory.createAbility(user);

    // ========================================================================
    // PASO 5: Evaluar TODAS las políticas
    // ========================================================================
    /**
     * Array.every() verifica que TODOS los handlers retornen true.
     * Es un AND lógico: el usuario debe cumplir TODAS las políticas.
     *
     * Si necesitas OR lógico (cumplir al menos una), usa Array.some().
     */
    const isAllowed = policyHandlers.every((handler) =>
      this.execPolicyHandler(handler, ability),
    );

    // ========================================================================
    // PASO 6: Manejar resultado
    // ========================================================================
    /**
     * Si alguna política falló, lanzamos ForbiddenException.
     * Esto genera una respuesta HTTP 403 con mensaje personalizado.
     *
     * ¿Por qué lanzar excepción en lugar de retornar false?:
     * - Permite personalizar el mensaje de error.
     * - El HttpExceptionFilter puede procesar la respuesta.
     * - Distingue claramente "403 Forbidden" de otros errores.
     */
    if (!isAllowed) {
      throw new ForbiddenException(
        'No tienes permiso para realizar esta acción',
      );
    }

    return true;
  }

  // ==========================================================================
  // MÉTODOS PRIVADOS
  // ==========================================================================

  /**
   * execPolicyHandler
   * =================
   *
   * Ejecuta un PolicyHandler individual según su tipo.
   *
   * @param handler - PolicyHandler a ejecutar (función o clase).
   * @param ability - Instancia de AppAbility del usuario actual.
   * @returns boolean - Resultado de la evaluación de la política.
   *
   * POLIMORFISMO EN ACCIÓN:
   * PolicyHandler puede ser:
   * 1. Función: (ability) => ability.can('action', 'Subject')
   * 2. Clase: { handle(ability) { return ability.can(...) } }
   *
   * Detectamos el tipo en runtime con typeof:
   * - typeof function === 'function'
   * - typeof object === 'object'
   */
  private execPolicyHandler(handler: PolicyHandler, ability: AppAbility) {
    if (typeof handler === 'function') {
      // Handler es una función callback → ejecutar directamente
      return handler(ability);
    }
    // Handler es un objeto con método handle → invocar el método
    return handler.handle(ability);
  }
}
