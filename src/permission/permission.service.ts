/**
 * ============================================================================
 * @file permission.service.ts
 * @description Servicio para gestión de permisos y carga de datos de autorización.
 * @module PermissionModule
 * ============================================================================
 *
 * MEMORIA TÉCNICA
 * ===============
 *
 * Este servicio encapsula la lógica de acceso a datos relacionada con permisos.
 * Su responsabilidad principal es cargar usuarios con su jerarquía completa
 * de permisos para que CaslAbilityFactory pueda construir Abilities.
 *
 * TAMBIÉN incluye métodos que demuestran verificación ABAC a nivel de servicio,
 * donde se conoce tanto al usuario como al recurso específico.
 *
 * ============================================================================
 */

// ============================================================================
// IMPORTS
// ============================================================================

/**
 * Injectable:
 * Decorador que permite inyectar este servicio en otros componentes.
 *
 * ForbiddenException:
 * Excepción HTTP 403 que se lanza cuando el usuario no tiene permiso.
 *
 * NotFoundException:
 * Excepción HTTP 404 que se lanza cuando el recurso no existe.
 */
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

/**
 * Action:
 * Enumeración de acciones permitidas (create, read, update, delete).
 * Generada por Prisma.
 */
import { Action } from 'generated/prisma/client';

/**
 * PrismaService:
 * Cliente de Prisma envuelto como servicio de NestJS.
 * Proporciona acceso tipado a la base de datos.
 */
import { PrismaService } from 'src/prisma.service';

/**
 * CaslAbilityFactory y User:
 * - CaslAbilityFactory: Para construir Abilities en verificaciones ABAC.
 * - User: Clase wrapper necesaria para que CASL identifique el tipo.
 */
import { CaslAbilityFactory, User, Post } from './casl-ability.factory';

// ============================================================================
// SERVICIO: PermissionService
// ============================================================================

@Injectable()
export class PermissionService {
  /**
   * Constructor con inyección de dependencias.
   *
   * @param prisma - Cliente de Prisma para acceso a base de datos.
   * @param caslAbilityFactory - Fábrica para crear Abilities de CASL.
   */
  constructor(
    private prisma: PrismaService,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  // ==========================================================================
  // MÉTODO: getUserWithPermissions
  // ==========================================================================

  /**
   * getUserWithPermissions
   * ======================
   *
   * Carga un usuario con toda su jerarquía de permisos.
   *
   * ESTRUCTURA RETORNADA:
   * ```
   * User
   * ├── roles[]
   * │   └── role
   * │       └── permissions[]
   * │           └── permission (action, subject, conditions)
   * └── directPermissions[]
   *     └── permission (action, subject, conditions)
   * ```
   *
   * FILTROS APLICADOS:
   * - Usuario: isActive: true, deletedAt: null
   * - Roles: role.isActive: true, no expirados
   * - Permisos directos: no expirados
   *
   * @param userId - ID del usuario a cargar.
   * @returns Usuario con permisos o null si no existe/inactivo.
   */
  async getUserWithPermissions(userId: number) {
    return await this.prisma.user.findFirst({
      where: {
        id: userId,
        isActive: true,
        deletedAt: null,
      },
      include: {
        roles: {
          where: {
            role: { isActive: true },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
        directPermissions: {
          where: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          include: { permission: true },
        },
      },
    });
  }

  // ==========================================================================
  // MÉTODO: getPostById
  // ==========================================================================

  /**
   * getPostById
   * ===========
   *
   * Carga un post por su ID.
   * Método auxiliar para demostraciones y pruebas.
   *
   * @param postId - ID del post a cargar.
   * @returns Post de Prisma o null si no existe.
   */
  async getPostById(postId: number) {
    return await this.prisma.post.findUnique({
      where: { id: postId },
    });
  }

  // ==========================================================================
  // MÉTODO: verifyPostAccess (ABAC en acción)
  // ==========================================================================

  /**
   * verifyPostAccess
   * ================
   *
   * Método que DEMUESTRA la verificación ABAC a nivel de servicio.
   *
   * FLUJO COMPLETO:
   * ┌─────────────────────────────────────────────────────────────────────┐
   * │ 1. Cargar el POST de la base de datos                              │
   * │    → Si no existe → NotFoundException (404)                        │
   * ├─────────────────────────────────────────────────────────────────────┤
   * │ 2. Cargar el USUARIO con permisos                                  │
   * │    → Si no existe/inactivo → ForbiddenException (403)              │
   * ├─────────────────────────────────────────────────────────────────────┤
   * │ 3. Construir ABILITY con CaslAbilityFactory                        │
   * │    → Combina RBAC + Claims del usuario                             │
   * ├─────────────────────────────────────────────────────────────────────┤
   * │ 4. VERIFICACIÓN ABAC                                               │
   * │    → ability.can(action, subject('Post', realPost))                │
   * │    → Evalúa condiciones como { authorId: "{{id}}" }                │
   * │    → Si falla → ForbiddenException con motivo                      │
   * ├─────────────────────────────────────────────────────────────────────┤
   * │ 5. RETORNAR información del proceso                                │
   * │    → Para fines demostrativos y debugging                          │
   * └─────────────────────────────────────────────────────────────────────┘
   *
   * ¿POR QUÉ ABAC EN EL SERVICIO?:
   * - El Guard (RBAC) verifica: "¿Puede este usuario hacer 'action' en Posts?"
   * - El Service (ABAC) verifica: "¿Puede hacer 'action' en ESTE post específico?"
   *
   * El Service conoce AMBOS: el usuario Y el recurso real.
   *
   * @param userId - ID del usuario que hace la petición.
   * @param postId - ID del post sobre el cual se verifica el permiso.
   * @param action - Acción a verificar (manage, create, read, update, delete).
   * @returns Objeto con detalles del proceso de verificación.
   * @throws NotFoundException - Si el post no existe.
   * @throws ForbiddenException - Si el usuario no tiene permiso.
   */
  async verifyPostAccess(userId: number, postId: number, action: Action) {
    // ========================================================================
    // PASO 1: Cargar el recurso (Post)
    // ========================================================================
    /**
     * Primero cargamos el recurso sobre el cual se quiere actuar.
     * Si no existe, lanzamos 404 ANTES de verificar permisos.
     * Esto es más eficiente y semánticamente correcto.
     */
    const post = await this.getPostById(postId);

    if (!post) {
      throw new NotFoundException(`Post con ID ${postId} no encontrado`);
    }

    // ========================================================================
    // PASO 2: Cargar usuario con permisos
    // ========================================================================
    /**
     * Cargamos el usuario con toda su jerarquía de permisos.
     * Si el usuario no existe o está inactivo, denegamos acceso.
     */
    const user = await this.getUserWithPermissions(userId);

    if (!user) {
      throw new ForbiddenException('Usuario no encontrado o inactivo');
    }

    // ========================================================================
    // PASO 3: Construir Ability
    // ========================================================================
    /**
     * CaslAbilityFactory combina:
     * 1. Permisos heredados de roles
     * 2. Grants directos (permisos extra)
     * 3. Revokes (prohibiciones que anulan lo anterior)
     *
     * Convertimos el user de Prisma a nuestra clase User wrapper
     * para que CASL pueda identificar el tipo correctamente.
     */
    const userWrapper = new User(user as Partial<User>);
    const ability = this.caslAbilityFactory.createAbility(userWrapper);

    // ========================================================================
    // PASO 4: Verificación ABAC
    // ========================================================================
    /**
     * AQUÍ ES DONDE OCURRE LA MAGIA DEL ABAC.
     *
     * ability.can(action, subject('Post', post)) evalúa:
     *
     * 1. Busca reglas que apliquen a action + 'Post'
     * 2. Para cada regla, verifica si las condiciones se cumplen
     * 3. Ejemplo: Si el permiso tiene { authorId: "{{id}}" }
     *    → Ya fue interpolado a { authorId: 5 } (id del usuario)
     *    → CASL verifica: post.authorId === 5
     * 4. La ÚLTIMA regla que coincide determina el resultado
     *
     * subject('Post', post) convierte el objeto Prisma en algo que
     * CASL reconoce como tipo 'Post' para buscar reglas.
     */
    const postWrapper = new Post(post);
    const canPerformAction = ability.can(action, postWrapper);

    // ========================================================================
    // PASO 5: Manejar resultado
    // ========================================================================
    /**
     * Si ABAC falla, lanzamos ForbiddenException con mensaje informativo.
     * En producción, podrías ser más genérico por seguridad.
     */
    if (!canPerformAction) {
      throw new ForbiddenException({
        message: `No tienes permiso para ${action} este post`,
        details: {
          action,
          postId: post.id,
          postAuthorId: post.authorId,
          userId: user.id,
          reason:
            post.authorId !== user.id
              ? 'No eres el autor de este post'
              : 'Permiso denegado por política de seguridad',
        },
      });
    }

    // ========================================================================
    // RETORNO: Información del proceso (para demo/debugging)
    // ========================================================================
    /**
     * Retornamos detalles del proceso de verificación.
     * En una aplicación real, aquí ejecutarías la acción y retornarías
     * el resultado de la operación (ej: el post actualizado).
     */
    return {
      success: true,
      verification: {
        action,
        allowed: true,
        user: {
          id: user.id,
          email: user.email,
        },
        post: {
          id: post.id,
          title: post.title,
          authorId: post.authorId,
        },
        isOwner: post.authorId === user.id,
        message:
          post.authorId === user.id
            ? 'Acceso permitido: Eres el autor del post'
            : 'Acceso permitido: Tienes permisos especiales',
      },
    };
  }
}
