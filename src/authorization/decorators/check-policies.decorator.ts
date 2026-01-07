/**
 * ============================================================================
 * @file check-policies.decorator.ts
 * @description Decorador para declarar requisitos de autorización en endpoints.
 * @module AuthorizationModule
 * ============================================================================
 *
 * MEMORIA TÉCNICA
 * ===============
 *
 * Este archivo implementa el decorador @CheckPolicies(), que permite declarar
 * de forma declarativa qué políticas de autorización debe cumplir un usuario
 * para acceder a un endpoint.
 *
 * PATRÓN DE DISEÑO: Decorator Pattern + Metadata
 * El decorador no ejecuta la lógica de autorización directamente, sino que
 * ALMACENA las políticas como metadata en el handler del controlador.
 * El PoliciesGuard luego EXTRAE este metadata y ejecuta las verificaciones.
 *
 * FLUJO DE EJECUCIÓN:
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ 1. @CheckPolicies(handler1, handler2) se ejecuta al cargar la app  │
 * │    → Almacena [handler1, handler2] como metadata en el método      │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ 2. Request llega al endpoint protegido                             │
 * │    → PoliciesGuard intercepta                                      │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ 3. PoliciesGuard usa Reflector para extraer metadata               │
 * │    → Obtiene [handler1, handler2]                                  │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ 4. PoliciesGuard ejecuta cada handler con el Ability del usuario   │
 * │    → Si TODOS retornan true → Acceso permitido                     │
 * │    → Si ALGUNO retorna false → ForbiddenException                  │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ============================================================================
 */

// ============================================================================
// IMPORTS
// ============================================================================

/**
 * SetMetadata:
 * Factory de decoradores de NestJS que almacena metadata en el target.
 *
 * ¿CÓMO FUNCIONA?:
 * SetMetadata(key, value) retorna un decorador que, cuando se aplica,
 * asocia el `value` con el `key` en el metadata del método o clase.
 *
 * ALMACENAMIENTO:
 * NestJS usa Reflect.defineMetadata() internamente. El metadata se guarda
 * en el prototype del handler (método del controlador).
 *
 * RECUPERACIÓN:
 * En Guards/Interceptors, usamos Reflector.get(key, target) para obtener
 * el valor almacenado.
 *
 * ¿POR QUÉ METADATA Y NO ARGUMENTOS DIRECTOS?:
 * Los decoradores se ejecutan en tiempo de compilación/carga, no de request.
 * El metadata permite "guardar información" que será leída después
 * cuando llegue cada request.
 */
import { SetMetadata } from '@nestjs/common';

/**
 * PolicyHandler:
 * Tipo unión que representa los manejadores de políticas válidos.
 * Puede ser una función callback o una clase que implementa IPolicyHandler.
 * Ver policy-handler.interface.ts para documentación detallada.
 */
import { PolicyHandler } from '../interfaces/policy-handler.interface';

// ============================================================================
// CONSTANTE: CHECK_POLICIES_KEY
// ============================================================================

/**
 * CHECK_POLICIES_KEY
 * ==================
 *
 * Clave única para almacenar y recuperar el metadata de políticas.
 *
 * CONVENCIONES DE NOMBRADO:
 * - Usar UPPER_SNAKE_CASE para constantes.
 * - Usar un valor descriptivo que evite colisiones.
 * - Exportar para que el Guard pueda usar la misma clave.
 *
 * IMPORTANCIA DE LA CONSISTENCIA:
 * El decorador y el Guard DEBEN usar la misma clave.
 * Si usaran claves diferentes, el Guard no encontraría las políticas.
 *
 * ```typescript
 * // En el decorador:
 * SetMetadata('check_policy', handlers)
 *
 * // En el guard:
 * this.reflector.get<PolicyHandler[]>('check_policy', context.getHandler())
 * ```
 */
export const CHECK_POLICIES_KEY = 'check_policy';

// ============================================================================
// DECORADOR: CheckPolicies
// ============================================================================

/**
 * CheckPolicies
 * =============
 *
 * Decorador de método que declara las políticas de autorización requeridas.
 *
 * SINTAXIS:
 * ```typescript
 * @CheckPolicies(...handlers: PolicyHandler[])
 * ```
 *
 * PARÁMETROS:
 * @param handlers - Lista de PolicyHandlers (funciones o clases).
 *                   Se usa rest parameter (...) para permitir múltiples handlers.
 *                   TODOS los handlers deben retornar true para permitir acceso.
 *
 * EJEMPLOS DE USO:
 *
 * 1. Política simple con función lambda:
 * ```typescript
 * @CheckPolicies((ability) => ability.can('read', 'Post'))
 * ```
 *
 * 2. Múltiples políticas (AND lógico):
 * ```typescript
 * @CheckPolicies(
 *   (ability) => ability.can('create', 'Post'),
 *   (ability) => ability.can('read', 'User')
 * )
 * // Usuario debe poder crear Posts Y leer Users
 * ```
 *
 * 3. Política con condiciones ABAC:
 * ```typescript
 * @CheckPolicies((ability) =>
 *   ability.can('update', subject('Post', { authorId: someUserId }))
 * )
 * ```
 *
 * 4. Super administrador:
 * ```typescript
 * @CheckPolicies((ability) => ability.can('manage', 'all'))
 * ```
 *
 * REQUISITOS PARA QUE FUNCIONE:
 * 1. El endpoint debe tener @UseGuards(PoliciesGuard)
 * 2. El usuario debe estar autenticado (JwtAuthGuard previo)
 * 3. El usuario debe tener permisos que satisfagan TODAS las políticas
 *
 * ORDEN DE DECORADORES:
 * ```typescript
 * @Get('endpoint')
 * @UseGuards(PoliciesGuard)      // Primero: activa el guard
 * @CheckPolicies(...)            // Segundo: define las políticas
 * async metodHandler() { ... }
 * ```
 *
 * NOTA: El orden de decoradores en TypeScript es de abajo hacia arriba,
 * pero para Guards, NestJS los ejecuta en orden de declaración.
 */
export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
