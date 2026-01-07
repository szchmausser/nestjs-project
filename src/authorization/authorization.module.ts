import { Module } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { CaslAbilityFactory } from './casl/casl-ability.factory';

/**
 * ============================================================================
 * @file authorization.module.ts (Antiguo permission.module.ts)
 * @description Módulo de NestJS que agrupa todos los componentes de autorización.
 * @module AuthorizationModule
 * ============================================================================
 */
@Module({
  providers: [AuthorizationService, CaslAbilityFactory],
  exports: [AuthorizationService, CaslAbilityFactory],
})
export class AuthorizationModule {}
