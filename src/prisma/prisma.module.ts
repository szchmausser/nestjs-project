import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * ============================================================================
 * @module PrismaModule
 * @description Módulo global que provee acceso al servicio de base de datos (Prisma).
 * ============================================================================
 *
 * MEMORIA TÉCNICA:
 * Al marcar este módulo como @Global(), evitamos tener que importarlo en cada
 * módulo que necesite acceso a la base de datos. Solo se importa una vez en
 * el AppModule y el PrismaService está disponible en toda la aplicación.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
