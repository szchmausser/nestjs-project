import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { AuthorizationModule } from '../authorization/authorization.module';

/**
 * ============================================================================
 * @module PostsModule
 * @description Módulo encargado de la gestión de contenidos (posts).
 * ============================================================================
 *
 * MEMORIA TÉCNICA:
 * Depende de AuthorizationModule para validar las reglas de acceso ABAC sobre
 * los posts individuales.
 */
@Module({
  imports: [AuthorizationModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
