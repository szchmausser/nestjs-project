/**
 * ============================================================================
 * @file policy-handler.interface.ts
 * @description Definición de tipos para los manejadores de políticas de autorización.
 * @module PermissionModule
 * ============================================================================
 *
 * MEMORIA TÉCNICA
 * ===============
 *
 * Este archivo define las interfaces y tipos que representan "Policy Handlers",
 * que son las funciones o clases que evalúan si un usuario tiene permiso
 * para acceder a un recurso protegido.
 *
 * PATRÓN DE DISEÑO: Strategy Pattern
 * Las políticas se definen como "handlers" intercambiables que encapsulan
 * diferentes estrategias de verificación de permisos. Esto permite:
 * - Definir políticas inline como funciones lambda.
 * - Definir políticas reutilizables como clases.
 * - Componer múltiples políticas en un solo endpoint.
 *
 * FLUJO DE USO:
 * 1. El desarrollador define políticas en @CheckPolicies(...handlers)
 * 2. PoliciesGuard extrae los handlers del metadata
 * 3. Para cada handler, se ejecuta según su tipo (función o clase)
 * 4. Si TODOS los handlers retornan true, el acceso es permitido
 *
 * ============================================================================
 */

// ============================================================================
// IMPORTS
// ============================================================================

/**
 * AppAbility:
 * Tipo que representa la instancia de CASL Ability configurada para nuestra app.
 * Contiene las reglas de autorización del usuario actual.
 * Se importa desde casl-ability.factory donde se define y construye.
 */
import { AppAbility } from '../casl/casl-ability.factory';

// ============================================================================
// INTERFAZ: IPolicyHandler
// ============================================================================

/**
 * IPolicyHandler
 * ==============
 *
 * Interfaz para policy handlers basados en clases.
 *
 * ¿CUÁNDO USAR CLASES EN VEZ DE FUNCIONES?:
 * - Cuando la lógica de evaluación es compleja.
 * - Cuando necesitas inyección de dependencias.
 * - Cuando quieres reutilizar la misma política en múltiples lugares.
 * - Cuando necesitas testear la política de forma aislada.
 *
 * EJEMPLO DE IMPLEMENTACIÓN:
 * ```typescript
 * @Injectable()
 * class ReadPostPolicyHandler implements IPolicyHandler {
 *   handle(ability: AppAbility): boolean {
 *     return ability.can('read', 'Post');
 *   }
 * }
 * ```
 *
 * USO EN CONTROLADOR:
 * ```typescript
 * @CheckPolicies(new ReadPostPolicyHandler())
 * ```
 *
 * NOTA: Los handlers basados en clases deben instanciarse manualmente
 * a menos que implementes un factory personalizado en el guard.
 */
export interface IPolicyHandler {
  /**
   * Método que evalúa si la política se cumple.
   *
   * @param ability - Instancia de AppAbility con las reglas del usuario actual.
   *                  Provee métodos can() y cannot() para verificar permisos.
   * @returns boolean - true si el usuario cumple la política, false si no.
   */
  handle(ability: AppAbility): boolean;
}

// ============================================================================
// TIPO: PolicyHandlerCallback
// ============================================================================

/**
 * PolicyHandlerCallback
 * =====================
 *
 * Tipo para policy handlers basados en funciones (callbacks).
 *
 * ¿CUÁNDO USAR FUNCIONES EN VEZ DE CLASES?:
 * - Cuando la verificación es simple (una línea).
 * - Cuando defines políticas inline en el decorador.
 * - Cuando no necesitas dependencias externas.
 * - Para prototipado rápido.
 *
 * EJEMPLOS DE USO:
 * ```typescript
 * // Verificación simple
 * @CheckPolicies((ability) => ability.can('read', 'Post'))
 *
 * // Verificación con subject específico
 * @CheckPolicies((ability) => ability.can('update', subject('Post', { authorId: 5 })))
 *
 * // Múltiples condiciones
 * @CheckPolicies(
 *   (ability) => ability.can('create', 'Post'),
 *   (ability) => ability.can('read', 'User')
 * )
 * ```
 *
 * VENTAJAS:
 * - Sintaxis concisa y legible.
 * - Ideal para casos de uso simples.
 * - No requiere crear archivos adicionales.
 */
type PolicyHandlerCallback = (ability: AppAbility) => boolean;

// ============================================================================
// TIPO UNIÓN: PolicyHandler
// ============================================================================

/**
 * PolicyHandler
 * =============
 *
 * Tipo unión que acepta tanto handlers basados en clases como funciones.
 *
 * PROPÓSITO:
 * Permite flexibilidad al desarrollador para elegir el estilo que prefiera
 * o que mejor se adapte a cada caso de uso.
 *
 * POLIMORFISMO:
 * El PoliciesGuard detecta el tipo de handler en runtime:
 * - Si es función → la ejecuta directamente: handler(ability)
 * - Si es objeto → llama al método handle: handler.handle(ability)
 *
 * DETECCIÓN EN RUNTIME:
 * ```typescript
 * private execPolicyHandler(handler: PolicyHandler, ability: AppAbility) {
 *   if (typeof handler === 'function') {
 *     return handler(ability);  // Es callback
 *   }
 *   return handler.handle(ability);  // Es clase con método handle()
 * }
 * ```
 *
 * BENEFICIOS DE ESTE DISEÑO:
 * 1. Flexibilidad: Usa funciones o clases según convenga.
 * 2. Consistencia: Un solo tipo para el sistema de políticas.
 * 3. Extensibilidad: Fácil agregar nuevos tipos de handlers.
 */
export type PolicyHandler = IPolicyHandler | PolicyHandlerCallback;
