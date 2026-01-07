/**
 * ============================================================================
 * @file casl-ability.factory.ts
 * @description Fábrica central para la gestión de permisos dinámicos con CASL.
 * @module AuthorizationModule
 * @version 2.0.0
 * ============================================================================
 *
 * MEMORIA TÉCNICA
 * ===============
 *
 * Este archivo implementa el motor de autorización de la aplicación,
 * actuando como el "cerebro" que decide qué puede o no puede hacer cada usuario.
 *
 * MODELO DE AUTORIZACIÓN HÍBRIDO:
 * Combina tres paradigmas de control de acceso:
 *
 * 1. RBAC (Role-Based Access Control):
 *    - Los usuarios heredan permisos a través de roles predefinidos.
 *    - Flujo: User → UserRole → Role → RolePermission → Permission
 *
 * 2. ABAC (Attribute-Based Access Control):
 *    - Los permisos pueden tener condiciones basadas en atributos del recurso.
 *    - Las condiciones se evalúan en tiempo de ejecución mediante interpolación.
 *
 * 3. Claims (Permisos Directos):
 *    - Permisos asignados directamente al usuario, sin pasar por roles.
 *    - Pueden OTORGAR (inverted: false) o REVOCAR (inverted: true) capacidades.
 *
 * ============================================================================
 */

import {
  AbilityBuilder,
  ExtractSubjectType,
  InferSubjects,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { parseConditions } from '../utils/conditions-parser.util';
import {
  User as PrismaUser,
  Post as PrismaPost,
  UserRole,
  Role,
  RolePermission,
  Permission,
  UserPermission,
  Action,
} from 'src/prisma/generated/prisma/client';

/**
 * CLASES WRAPPER (Envoltorio para entidades de Prisma)
 * =============================================
 * Estas clases permiten que CASL identifique el tipo de un objeto (Subject)
 * para aplicar las reglas correctamente sobre objetos planos de Prisma.
 */

export class Post implements Partial<PrismaPost> {
  constructor(partial: Partial<PrismaPost>) {
    Object.assign(this, partial);
  }
  id!: number;
  authorId!: number;
  isPublished!: boolean;
}

export class User implements Partial<PrismaUser> {
  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
  id!: number;
  email!: string;
  roles!: (UserRole & {
    role: Role & {
      permissions: (RolePermission & {
        permission: Permission;
      })[];
    };
  })[];
  directPermissions!: (UserPermission & {
    permission: Permission;
  })[];
}

/**
 * TIPOS DE CASL
 */

export type Subjects =
  | InferSubjects<typeof Post | typeof User, true>
  | 'Post'
  | 'User'
  | 'all';

export type AppAbility = MongoAbility<[Action, Subjects]>;

/**
 * CaslAbilityFactory
 * ==================
 * Servicio que construye instancias de AppAbility personalizadas.
 */
@Injectable()
export class CaslAbilityFactory {
  /**
   * createAbility
   * =============
   * Construye el set de habilidades para un usuario basándose en roles y claims.
   * LA ÚLTIMA REGLA QUE COINCIDE ES LA QUE GANA.
   */
  createAbility(user: User): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      createMongoAbility,
    );

    if (user) {
      // 1. Roles (Base)
      user.roles.forEach((ur) => {
        ur.role.permissions.forEach((rp) => {
          can(
            rp.permission.action,
            rp.permission.subject,
            parseConditions(rp.permission.conditions, user),
          );
        });
      });

      // 2. Grants (inverted: false)
      user.directPermissions
        .filter((dp) => !dp.inverted)
        .forEach((dp) => {
          can(
            dp.permission.action,
            dp.permission.subject,
            parseConditions(dp.permission.conditions, user),
          );
        });

      // 3. Revokes (inverted: true) - Tienen prioridad máxima
      user.directPermissions
        .filter((dp) => dp.inverted)
        .forEach((dp) => {
          cannot(
            dp.permission.action,
            dp.permission.subject,
            parseConditions(dp.permission.conditions, user),
          ).because(dp.reason ?? '');
        });
    }

    return build({
      detectSubjectType: (item) =>
        (item as object).constructor.name as ExtractSubjectType<Subjects>,
    });
  }
}
