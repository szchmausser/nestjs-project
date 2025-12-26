/**
 * ============================================================================
 * @file app.controller.ts
 * @description Controlador de pruebas para validar autenticación y autorización.
 * @module AppModule
 * ============================================================================
 *
 * MEMORIA TÉCNICA
 * ===============
 *
 * Este controlador sirve como "campo de pruebas" para el sistema de seguridad.
 * Expone endpoints que demuestran diferentes niveles de protección:
 *
 * ENDPOINTS DISPONIBLES:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ GET /test/public        │ Sin protección, acceso libre                 │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ GET /test/protected     │ Requiere JWT válido (autenticación)          │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ GET /test/authorization │ Reporte completo de permisos del usuario     │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ GET /test/check-policy  │ Ejemplo de protección por políticas CASL     │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ GET /test/abac-demo/:id │ Demo ABAC: Guard (RBAC) + Service (ABAC)     │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * USO RECOMENDADO:
 * 1. Probar /test/public para verificar que el servidor responde.
 * 2. Probar /test/protected sin token → debe fallar con 401.
 * 3. Obtener token con POST /auth/login.
 * 4. Probar /test/protected con token → debe mostrar datos del usuario.
 * 5. Probar /test/authorization → ver reporte de permisos.
 * 6. Probar /test/check-policy → verificar política específica.
 *
 * ============================================================================
 */

// NOTA: Se desactivan reglas de ESLint para permitir tipados flexibles
// en las respuestas de prueba y mapeos de objetos Prisma.

// ============================================================================
// IMPORTS - NestJS Core
// ============================================================================

/**
 * Controller:
 * Decorador que marca esta clase como controlador de NestJS.
 * El parámetro 'test' define el prefijo de ruta: todos los endpoints
 * en este controlador estarán bajo /test/...
 *
 * Get:
 * Decorador de método HTTP. Marca el método como handler de peticiones GET.
 * El parámetro opcional define el sub-path (ej: @Get('public') → /test/public).
 *
 * UseGuards:
 * Decorador que activa Guards específicos para un método o controlador.
 * Los Guards se ejecutan ANTES del handler y pueden bloquear la request.
 */
import {
  Controller,
  Get,
  UseGuards,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';

// ============================================================================
// IMPORTS - Decoradores Custom
// ============================================================================

/**
 * Public:
 * Decorador custom que marca un endpoint como "público".
 *
 * ¿CÓMO FUNCIONA?:
 * Añade metadata que el JwtAuthGuard lee. Si existe, el guard permite
 * el acceso sin validar JWT. Sin este decorador, JwtAuthGuard (global)
 * rechazaría cualquier request sin token válido.
 *
 * IMPLEMENTACIÓN (ver public.decorator.ts):
 * export const Public = () => SetMetadata('isPublic', true);
 */
import { Public } from './common/decorators/public.decorator';

/**
 * CurrentUser:
 * Decorador de parámetro que extrae el usuario del request.
 *
 * ¿CÓMO FUNCIONA?:
 * 1. JwtAuthGuard valida el JWT y añade el payload a request.user.
 * 2. @CurrentUser() es un atajo para acceder a request.user.
 * 3. Opcionalmente acepta un campo para extraer propiedad específica.
 *
 * IMPLEMENTACIÓN (ver current-user.decorator.ts):
 * export const CurrentUser = createParamDecorator(
 *   (data, ctx) => ctx.switchToHttp().getRequest().user
 * );
 */
import { CurrentUser } from './common/decorators/current-user.decorator';

// ============================================================================
// IMPORTS - Tipos e Interfaces
// ============================================================================

/**
 * UserPayload:
 * Interfaz que define la estructura del payload del JWT decodificado.
 * Contiene los datos mínimos del usuario: { id, email, iat, exp }.
 *
 * ¿Por qué usar 'type' import?:
 * El 'type' indica que solo se importa para TypeScript, no para runtime.
 * Es una buena práctica que clarifica intención y optimiza bundling.
 */
import type { UserPayload } from './auth/interfaces/user-payload.interface';

// ============================================================================
// IMPORTS - Servicios de Permisos
// ============================================================================

/**
 * PermissionService:
 * Servicio que carga usuarios con su jerarquía completa de permisos.
 * Usado en /test/authorization para obtener datos de prueba.
 */
import { PermissionService } from './permission/permission.service';

/**
 * CaslAbilityFactory:
 * Fábrica que construye Abilities de CASL para usuarios.
 * Usado para demostrar evaluación de permisos en /test/authorization.
 */
import { CaslAbilityFactory } from './permission/casl-ability.factory';

// ============================================================================
// IMPORTS - Guards y Decoradores de Políticas
// ============================================================================

/**
 * PoliciesGuard:
 * Guard que evalúa políticas CASL definidas con @CheckPolicies.
 * Se activa manualmente con @UseGuards(PoliciesGuard).
 */
import { PoliciesGuard } from './permission/guards/policies.guard';

/**
 * CheckPolicies:
 * Decorador que declara qué políticas debe cumplir el usuario.
 * Trabaja en conjunto con PoliciesGuard.
 */
import { CheckPolicies } from './permission/decorators/check-policies.decorator';

/**
 * AppAbility, User, Post:
 * - AppAbility: Tipo de la instancia Ability configurada para nuestra aplicación.
 * - User: Clase wrapper con tipado profundo de roles y permisos.
 * - Post: Clase wrapper para posts con propiedades ABAC.
 */
import { AppAbility, User, Post } from './permission/casl-ability.factory';

/**
 * Action:
 * Enum generado por Prisma con las acciones válidas del sistema.
 */
import { Action } from 'generated/prisma/client';

// ============================================================================
// CONTROLADOR: AppController
// ============================================================================

/**
 * AppController
 * =============
 *
 * Controlador de pruebas bajo el prefijo '/test'.
 *
 * PROPÓSITO:
 * Proveer endpoints para verificar que el sistema de autenticación y
 * autorización funciona correctamente. Útil durante desarrollo y para
 * pruebas manuales con herramientas como Postman o curl.
 *
 * NOTA: En producción, considera restringir o remover este controlador
 * para evitar exposición de información sensible.
 */
@Controller('test')
export class AppController {
  /**
   * Constructor con inyección de dependencias.
   *
   * @param permissionService - Servicio para cargar permisos de usuarios.
   * @param caslAbilityFactory - Fábrica para crear instancias de Ability.
   */
  constructor(
    private readonly permissionService: PermissionService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  // ==========================================================================
  // ENDPOINT: /test/public
  // ==========================================================================

  /**
   * getPublic
   * =========
   *
   * Endpoint completamente público, sin ningún tipo de protección.
   *
   * DECORADORES:
   * @Public() - Añade metadata 'isPublic: true' al handler.
   *             El JwtAuthGuard lee este metadata y permite el acceso
   *             sin validar JWT.
   *
   * CASOS DE USO:
   * - Health checks de infraestructura.
   * - Páginas de landing o información pública.
   * - Endpoints que no requieren identificación del usuario.
   *
   * PRUEBA:
   * curl http://localhost:3000/test/public
   * → Debe responder con mensaje de éxito sin requerir token.
   */
  @Public()
  @Get('public')
  getPublic() {
    return {
      message: 'Este es un endpoint público (No requiere token)',
      timestamp: new Date(),
    };
  }

  // ==========================================================================
  // ENDPOINT: /test/protected
  // ==========================================================================

  /**
   * getProtected
   * ============
   *
   * Endpoint protegido que requiere JWT válido.
   *
   * ¿POR QUÉ NO HAY @UseGuards(JwtAuthGuard)?:
   * El JwtAuthGuard está configurado como guard GLOBAL en AppModule.
   * Esto significa que se aplica a TODOS los endpoints automáticamente.
   * Solo los marcados con @Public() quedan exentos.
   *
   * FLUJO:
   * 1. Request llega a /test/protected
   * 2. JwtAuthGuard (global) intercepta
   * 3. No hay @Public() → valida el header Authorization
   * 4. Extrae y verifica el JWT
   * 5. Añade payload decodificado a request.user
   * 6. Handler se ejecuta con acceso a @CurrentUser()
   *
   * PARÁMETROS:
   * @param user - Payload del JWT inyectado por @CurrentUser().
   *               Tipado como UserPayload para autocompletado y type-safety.
   *
   * PRUEBA:
   * # Sin token (debe fallar):
   * curl http://localhost:3000/test/protected
   * → 401 Unauthorized
   *
   * # Con token válido:
   * curl -H "Authorization: Bearer <token>" http://localhost:3000/test/protected
   * → Datos del usuario
   */
  @Get('protected')
  getProtected(@CurrentUser() user: UserPayload) {
    return {
      message: 'Acceso concedido: Token válido detectado',
      user,
      timestamp: new Date(),
    };
  }

  // ==========================================================================
  // ENDPOINT: /test/authorization
  // ==========================================================================

  /**
   * getAuthorization
   * ================
   *
   * Endpoint de diagnóstico que muestra los permisos completos del usuario.
   *
   * PROPÓSITO:
   * Permite visualizar todos los permisos que un usuario tiene,
   * incluyendo permisos heredados de roles y permisos directos.
   * También muestra pruebas ABAC con diferentes escenarios.
   *
   * FLUJO:
   * 1. Obtiene userId del JWT (via @CurrentUser)
   * 2. Carga usuario COMPLETO desde DB (con roles y permisos)
   * 3. Construye Ability usando CaslAbilityFactory
   * 4. Ejecuta pruebas de permisos para diferentes escenarios
   * 5. Retorna reporte estructurado
   *
   * CASOS DE PRUEBA INCLUIDOS:
   * - RBAC básico: manage:all, read:Post, create:Post, read:User
   * - ABAC ownership: update/delete de posts propios vs ajenos
   *
   * @param currentUser - Payload del JWT con id del usuario.
   * @returns Reporte detallado de permisos y resultados de pruebas.
   */
  @Get('authorization')
  async getAuthorization(@CurrentUser() currentUser: UserPayload) {
    // ========================================================================
    // PASO 1: Cargar usuario con jerarquía completa de permisos
    // ========================================================================
    /**
     * PermissionService.getUserWithPermissions() ejecuta:
     * - Query a User con filtros (isActive, deletedAt)
     * - Include de roles → role → permissions → permission
     * - Include de directPermissions → permission
     *
     * Esto trae TODA la información necesaria para construir el Ability.
     */
    const user = await this.permissionService.getUserWithPermissions(
      currentUser.id,
    );

    /**
     * Guard: Si el usuario no existe o está inactivo.
     * Podría ocurrir si el JWT es válido pero el usuario fue desactivado
     * después de emitir el token.
     */
    if (!user) {
      return {
        success: false,
        error: 'Usuario no encontrado o inactivo',
        userId: currentUser.id,
      };
    }

    // ========================================================================
    // PASO 2: Construir Ability de CASL
    // ========================================================================
    /**
     * createAbility() procesa:
     * 1. Permisos de roles (base)
     * 2. Grants directos (expanden capacidades)
     * 3. Revokes (restringen capacidades, máxima prioridad)
     *
     * createAbility() procesa:
     * 1. Roles (RBAC) -> 2. Grants directos -> 3. Revokes (inverted: true)
     */
    const ability = this.caslAbilityFactory.createAbility(user);

    // ========================================================================
    // PASO 3: Crear Posts de prueba para ABAC
    // ========================================================================
    /**
     * Creamos instancias de Post usando la clase importada del factory.
     *
     * ¿Por qué usar la clase Post del factory?:
     * - Tiene tipado correcto y consistente.
     * - CASL detecta el tipo usando constructor.name ('Post').
     * - Evita duplicación de código con clases locales.
     *
     * Los posts de prueba simulan:
     * - myPost: Post creado por el usuario actual (ownership)
     * - otherPost: Post de otro usuario (no ownership)
     */

    /** Post del usuario actual - debería poder editarlo/eliminarlo */
    const myPost = new Post({ id: 100, authorId: user.id, isPublished: true });

    /** Post de otro usuario - permisos dependen de la configuración */
    const otherPost = new Post({ id: 200, authorId: 999, isPublished: true });

    // ========================================================================
    // PASO 4: Generar y retornar reporte completo
    // ========================================================================
    return {
      success: true,

      // Información básica del usuario
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
      },

      // Lista de roles asignados con metadata
      // Tipado: User['roles'][0] es el tipo de cada elemento del array roles
      roles: user.roles.map((ur: User['roles'][0]) => ({
        name: ur.role.name,
        isActive: ur.role.isActive,
        expiresAt: ur.expiresAt,
      })),

      // Lista de permisos directos (claims)
      // Tipado: User['directPermissions'][0] es el tipo de cada permiso directo
      directPermissions: user.directPermissions.map(
        (dp: User['directPermissions'][0]) => ({
          action: dp.permission.action,
          subject: dp.permission.subject,
          inverted: dp.inverted,
          reason: dp.reason,
          expiresAt: dp.expiresAt,
        }),
      ),

      /**
       * REPORTE DE TESTS
       * ================
       *
       * Cada test muestra: ability.can(action, subject) → boolean
       *
       * Interpretación:
       * - true: El usuario PUEDE realizar la acción.
       * - false: El usuario NO PUEDE realizar la acción.
       *
       * Los tests ABAC usan subject() para crear objetos con propiedades
       * que CASL evalúa contra las condiciones de los permisos.
       *
       * NOTA: El cast 'as any' es por incompatibilidad de tipos entre
       * subject() y el tipado estricto de Subjects. Es seguro porque
       * controlamos los valores.
       */
      tests: {
        // ====================================================================
        // TESTS RBAC (Role-Based Access Control)
        // ====================================================================
        /** Super admin: puede hacer TODO sobre TODOS los recursos */
        'manage:all': ability.can(Action.manage, 'all'),

        /** Permisos básicos sobre Posts */
        'read:Post': ability.can(Action.read, 'Post'),
        'create:Post': ability.can(Action.create, 'Post'),

        /** Permisos sobre Users */
        'read:User': ability.can(Action.read, 'User'),

        // ====================================================================
        // TESTS ABAC (Attribute-Based Access Control)
        // ====================================================================
        /**
         * Update sobre post propio.
         * Si tiene permiso con condición { authorId: "{{id}}" },
         * esto debería retornar true.
         *
         * Usamos new Post() en vez de subject() para evitar el cast 'as any'.
         * La clase Post ya está registrada en detectSubjectType de CASL.
         */
        'update:Post (mi post)': ability.can(Action.update, myPost),

        /**
         * Update sobre post ajeno.
         * Con condición de ownership, debería retornar false.
         */
        'update:Post (post ajeno)': ability.can(Action.update, otherPost),

        /**
         * Delete sobre post propio.
         * Similar a update: depende de las condiciones configuradas.
         */
        'delete:Post (mi post)': ability.can(Action.delete, myPost),

        /**
         * Delete sobre post ajeno.
         * Importante para verificar que revokes funcionan correctamente.
         */
        'delete:Post (post ajeno)': ability.can(Action.delete, otherPost),
      },

      timestamp: new Date(),
    };
  }

  // ==========================================================================
  // ENDPOINT: /test/check-policy
  // ==========================================================================

  /**
   * testPolicy
   * ==========
   *
   * Endpoint de ejemplo que demuestra el uso de @CheckPolicies con PoliciesGuard.
   *
   * DECORADORES EN ACCIÓN:
   *
   * @UseGuards(PoliciesGuard):
   * Activa el guard que evalúa políticas. Este guard:
   * 1. Extrae las políticas del metadata de @CheckPolicies
   * 2. Carga permisos del usuario desde la DB
   * 3. Construye el Ability
   * 4. Evalúa cada política
   * 5. Permite o deniega acceso
   *
   * @CheckPolicies((ability: AppAbility) => ability.can('create', 'Post')):
   * Define la política requerida: el usuario debe poder crear Posts.
   *
   * EJEMPLOS ALTERNATIVOS:
   *
   * 1. Requerir admin (manage all):
   * @CheckPolicies((ability) => ability.can('manage', 'all'))
   *
   * 2. Requerir múltiples permisos (AND):
   * @CheckPolicies(
   *   (ability) => ability.can('create', 'Post'),
   *   (ability) => ability.can('read', 'User')
   * )
   *
   * 3. Verificar permiso sobre recurso específico (ABAC):
   * @CheckPolicies((ability) =>
   *   ability.can('update', subject('Post', { authorId: someId }))
   * )
   *
   * PRUEBA:
   * # Sin permiso de crear Posts:
   * curl -H "Authorization: Bearer <token>" http://localhost:3000/test/check-policy
   * → 403 Forbidden (si el usuario no puede crear Posts)
   *
   * # Con permiso:
   * → Mensaje de éxito
   */
  @Get('check-policy')
  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.create, 'Post'))
  testPolicy() {
    return {
      success: true,
      message:
        '¡Felicidades! Tienes el permiso necesario para entrar a esta ruta.',
      policy_checked: `can ${Action.create} Post`,
    };
  }

  // ==========================================================================
  // ENDPOINTS RESTFUL: Demo ABAC con métodos HTTP correctos
  // ==========================================================================

  /**
   * DEMO ABAC: Rutas RESTful para Posts
   * ====================================
   *
   * Estos endpoints demuestran el flujo completo de autorización usando
   * métodos HTTP estándar según las convenciones REST:
   *
   * ┌─────────────────────────────────────────────────────────────────────┐
   * │ GET    /test/posts/:id  │ Leer un post (requiere 'read' Post)      │
   * ├─────────────────────────────────────────────────────────────────────┤
   * │ PATCH  /test/posts/:id  │ Actualizar un post (requiere 'update')   │
   * ├─────────────────────────────────────────────────────────────────────┤
   * │ DELETE /test/posts/:id  │ Eliminar un post (requiere 'delete')     │
   * └─────────────────────────────────────────────────────────────────────┘
   *
   * FLUJO DE AUTORIZACIÓN (igual para todos):
   *
   * 1. JwtAuthGuard (global) → Valida JWT
   * 2. PoliciesGuard (RBAC) → Verifica permiso general sobre 'Post'
   * 3. PermissionService (ABAC) → Verifica permiso sobre ESTE post
   *
   * PRUEBAS CON CURL:
   *
   * # Leer post propio:
   * curl -X GET -H "Authorization: Bearer <token>" \
   *      http://localhost:3000/test/posts/1
   *
   * # Actualizar post propio:
   * curl -X PATCH -H "Authorization: Bearer <token>" \
   *      http://localhost:3000/test/posts/1
   *
   * # Eliminar post (cuidado con permisos):
   * curl -X DELETE -H "Authorization: Bearer <token>" \
   *      http://localhost:3000/test/posts/1
   */

  // --------------------------------------------------------------------------
  // GET /test/posts/:id - Leer un post
  // --------------------------------------------------------------------------

  /**
   * getPost (READ)
   * ==============
   *
   * Endpoint para leer un post específico.
   *
   * FLUJO DE AUTORIZACIÓN:
   * 1. JwtAuthGuard (global) → Valida JWT
   * 2. PoliciesGuard (RBAC) → Verifica: ability.can('read', 'Post')
   * 3. PermissionService (ABAC) → Verifica permiso sobre ESTE post
   *    → Si no tiene permiso → lanza ForbiddenException (403)
   *    → Si tiene permiso → retorna info de verificación
   *
   * En una app real, aquí cargarías el post completo y lo retornarías.
   */
  @Get('posts/:id')
  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.read, 'Post'))
  async getPost(
    @Param('id') id: string,
    @CurrentUser() currentUser: UserPayload,
  ) {
    // ABAC: Verifica permiso sobre este post específico (lanza 403 si no puede)
    const result = await this.permissionService.verifyPostAccess(
      currentUser.id,
      +id,
      Action.read,
    );

    // Si llegamos aquí, tiene permiso. En producción retornarías el post.
    return result;
  }

  // --------------------------------------------------------------------------
  // PATCH /test/posts/:id - Actualizar un post
  // --------------------------------------------------------------------------

  /**
   * updatePost (UPDATE)
   * ===================
   *
   * Endpoint para actualizar un post específico.
   *
   * FLUJO DE AUTORIZACIÓN:
   * 1. JwtAuthGuard (global) → Valida JWT
   * 2. PoliciesGuard (RBAC) → Verifica: ability.can('update', 'Post')
   * 3. PermissionService (ABAC) → Verifica permiso sobre ESTE post
   *    → Si no tiene permiso → lanza ForbiddenException (403)
   *
   * CASO TÍPICO ABAC:
   * El permiso tiene condición { authorId: "{{id}}" }, permitiendo
   * solo actualizar posts propios.
   */
  @Patch('posts/:id')
  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.update, 'Post'))
  async updatePost(
    @Param('id') id: string,
    @CurrentUser() currentUser: UserPayload,
  ) {
    // ABAC: Verifica permiso sobre este post específico
    const result = await this.permissionService.verifyPostAccess(
      currentUser.id,
      +id,
      Action.update,
    );

    // En producción: await this.postService.update(+id, updateDto)
    return result;
  }

  // --------------------------------------------------------------------------
  // DELETE /test/posts/:id - Eliminar un post
  // --------------------------------------------------------------------------

  /**
   * deletePost (DELETE)
   * ===================
   *
   * Endpoint para eliminar un post específico.
   *
   * FLUJO DE AUTORIZACIÓN:
   * 1. JwtAuthGuard (global) → Valida JWT
   * 2. PoliciesGuard (RBAC) → Verifica: ability.can('delete', 'Post')
   * 3. PermissionService (ABAC) → Verifica permiso sobre ESTE post
   *    → Si no tiene permiso → lanza ForbiddenException (403)
   *
   * REVOKES EN ACCIÓN:
   * Un revoke con { authorId: "{{id}}" } para delete significaría
   * que el usuario NO puede eliminar sus propios posts (sanción).
   */
  @Delete('posts/:id')
  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.delete, 'Post'))
  async deletePost(
    @Param('id') id: string,
    @CurrentUser() currentUser: UserPayload,
  ) {
    // ABAC: Verifica permiso sobre este post específico
    const result = await this.permissionService.verifyPostAccess(
      currentUser.id,
      +id,
      Action.delete,
    );

    // En producción: await this.postService.delete(+id)
    return result;
  }
}
