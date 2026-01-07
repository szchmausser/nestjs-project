import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Action } from 'src/prisma/generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CaslAbilityFactory, User, Post } from './casl/casl-ability.factory';

/**
 * ============================================================================
 * @file authorization.service.ts (Antiguo permission.service.ts)
 * @description Servicio para gestión de permisos y carga de datos de autorización.
 * @module AuthorizationModule
 * ============================================================================
 *
 * MEMORIA TÉCNICA:
 * Este servicio encapsula la lógica de acceso a datos relacionada con permisos.
 * Su responsabilidad principal es cargar usuarios con su jerarquía completa
 * para construir Abilities y verificar accesos ABAC.
 */
@Injectable()
export class AuthorizationService {
  constructor(
    private prisma: PrismaService,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  /**
   * Carga un usuario con toda su jerarquía de permisos.
   * Aplica filtros de estado (isActive, deletedAt) y expiración.
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

  /**
   * Verifica el acceso ABAC sobre un Post específico.
   * Lógica compartida para demonstrar el motor de CASL.
   */
  async verifyPostAccess(userId: number, postId: number, action: Action) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException(`Post con ID ${postId} no encontrado`);
    }

    const user = await this.getUserWithPermissions(userId);

    if (!user) {
      throw new ForbiddenException('Usuario no encontrado o inactivo');
    }

    const userWrapper = new User(user as Partial<User>);
    const ability = this.caslAbilityFactory.createAbility(userWrapper);

    const postWrapper = new Post(post);
    const canPerformAction = ability.can(action, postWrapper);

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

    return {
      success: true,
      verification: {
        action,
        allowed: true,
        user: { id: user.id, email: user.email },
        post: { id: post.id, title: post.title, authorId: post.authorId },
        isOwner: post.authorId === user.id,
      },
    };
  }
}
