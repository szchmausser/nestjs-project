import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

/**
 * ============================================================================
 * @module UsersModule
 * @description Módulo encargado de la gestión de usuarios.
 * ============================================================================
 */
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
