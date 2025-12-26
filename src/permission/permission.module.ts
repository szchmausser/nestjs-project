/**
 * ============================================================================
 * @file permission.module.ts
 * @description Módulo de NestJS que agrupa todos los componentes de autorización.
 * @module PermissionModule
 * ============================================================================
 *
 * MEMORIA TÉCNICA
 * ===============
 *
 * Este módulo encapsula todo el sistema de autorización basado en CASL,
 * siguiendo el principio de cohesión de NestJS: agrupar funcionalidad relacionada.
 *
 * COMPONENTES DEL MÓDULO:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ PermissionModule                                                       │
 * │ ├── CaslAbilityFactory   → Construye Abilities para usuarios           │
 * │ ├── PermissionService    → Carga permisos desde la base de datos       │
 * │ ├── PoliciesGuard        → Evalúa políticas en endpoints (no listado)  │
 * │ ├── @CheckPolicies       → Decorador para declarar políticas (no list) │
 * │ └── PolicyHandler        → Interfaces de tipos (no listado)            │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * NOTA SOBRE GUARDS Y DECORADORES:
 * Los Guards y Decoradores NO se registran como providers del módulo.
 * - PoliciesGuard se usa con @UseGuards() a nivel de método/controller.
 * - @CheckPolicies es un decorador, no un servicio.
 *
 * DEPENDENCIAS:
 * - PrismaService: Para acceso a la base de datos (inyectado en PermissionService).
 *
 * ============================================================================
 */

// ============================================================================
// IMPORTS
// ============================================================================

/**
 * Module:
 * Decorador de NestJS que define un módulo.
 * Los módulos son la unidad organizacional principal de NestJS.
 * Agrupan providers, controllers, imports y exports relacionados.
 */
import { Module } from '@nestjs/common';

/**
 * PermissionService:
 * Servicio que encapsula la lógica de carga de permisos desde la DB.
 * Expone getUserWithPermissions() para obtener usuarios con su jerarquía completa.
 */
import { PermissionService } from './permission.service';

/**
 * PrismaService:
 * Cliente de Prisma envuelto como servicio de NestJS.
 * Usado por PermissionService para ejecutar queries a la DB.
 * Se registra aquí como provider porque es necesario localmente.
 */
import { PrismaService } from 'src/prisma.service';

/**
 * CaslAbilityFactory:
 * Fábrica que construye instancias de AppAbility personalizadas.
 * Es el componente central que combina RBAC + ABAC + Claims.
 */
import { CaslAbilityFactory } from './casl-ability.factory';

// ============================================================================
// DEFINICIÓN DEL MÓDULO
// ============================================================================

/**
 * @Module Configuration
 * =====================
 *
 * providers:
 * Servicios disponibles DENTRO de este módulo.
 * NestJS los instancia y gestiona su ciclo de vida.
 * - PermissionService: Carga permisos de usuarios.
 * - PrismaService: Acceso a base de datos.
 * - CaslAbilityFactory: Construcción de Abilities.
 *
 * exports:
 * Servicios que OTROS módulos pueden usar cuando importan PermissionModule.
 * - PermissionService: Para Guards que necesitan cargar permisos.
 * - CaslAbilityFactory: Para crear Abilities en cualquier parte de la app.
 *
 * NOTA: PrismaService NO se exporta porque es un detalle de implementación.
 * Otros módulos que necesiten Prisma deben importarlo desde un módulo global.
 *
 * imports: (vacío)
 * Este módulo no importa otros módulos de NestJS.
 *
 * controllers: (vacío)
 * Este módulo no expone endpoints. Los endpoints que usan autorización
 * están en otros controladores que importan PermissionModule.
 */
@Module({
  providers: [PermissionService, PrismaService, CaslAbilityFactory],
  exports: [PermissionService, CaslAbilityFactory],
})
export class PermissionModule {}
