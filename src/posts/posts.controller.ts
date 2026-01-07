import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserPayload } from '../authentication/interfaces/user-payload.interface';
import { Action, Prisma } from 'src/prisma/generated/prisma/client';
import { PoliciesGuard } from '../authorization/guards/policies.guard';
import { CheckPolicies } from '../authorization/decorators/check-policies.decorator';
import type { AppAbility } from '../authorization/casl/casl-ability.factory';
import { AuthorizationService } from '../authorization/authorization.service';

/**
 * ============================================================================
 * @file posts.controller.ts
 * @description Controlador RESTful para la gestión de Posts.
 * @module PostsModule
 * ============================================================================
 *
 * MEMORIA TÉCNICA:
 * Implementa un flujo de autorización HÍBRIDO:
 * 1. RBAC via PoliciesGuard: ¿Tiene el usuario el permiso general sobre 'Post'?
 * 2. ABAC via PermissionService: ¿Tiene permiso sobre este POST específico?
 *
 * Esta estructura permite una separación clara entre la lógica de negocio y
 * las reglas de seguridad complejas.
 */
@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  /**
   * Crear un nuevo post.
   * RBAC: Requiere capacidad 'create' sobre el sujeto 'Post'.
   */
  @Post()
  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.create, 'Post'))
  create(
    @Body() createPostDto: Prisma.PostUncheckedCreateInput,
    @CurrentUser() user: UserPayload,
  ) {
    // Forzamos el authorId al del usuario autenticado por seguridad
    return this.postsService.create({
      ...createPostDto,
      authorId: user.id,
    });
  }

  /**
   * Listar todos los posts.
   * RBAC: Requiere capacidad 'read' sobre 'Post'.
   */
  @Get()
  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.read, 'Post'))
  findAll() {
    return this.postsService.findAll();
  }

  /**
   * Obtener un post por ID.
   * ABAC: Verifica si el usuario puede leer ESTE post específico.
   */
  @Get(':id')
  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.read, 'Post'))
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserPayload,
  ) {
    // Verificación ABAC profunda antes de retornar los datos
    await this.authorizationService.verifyPostAccess(user.id, id, Action.read);
    return this.postsService.findOne(id);
  }

  /**
   * Actualizar un post.
   * ABAC: Verifica si el usuario puede actualizar ESTE post específico (ownership, etc.)
   */
  @Patch(':id')
  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.update, 'Post'))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePostDto: Prisma.PostUpdateInput,
    @CurrentUser() user: UserPayload,
  ) {
    // Verificación ABAC profunda
    await this.authorizationService.verifyPostAccess(
      user.id,
      id,
      Action.update,
    );
    return this.postsService.update(id, updatePostDto);
  }

  /**
   * Eliminar un post.
   * ABAC: Verifica si el usuario puede eliminar ESTE post específico.
   */
  @Delete(':id')
  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.delete, 'Post'))
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserPayload,
  ) {
    // Verificación ABAC profunda
    await this.authorizationService.verifyPostAccess(
      user.id,
      id,
      Action.delete,
    );
    return this.postsService.remove(id);
  }
}
