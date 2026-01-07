import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Post, Prisma } from 'src/prisma/generated/prisma/client';

/**
 * ============================================================================
 * @file posts.service.ts
 * @description Servicio para la gestión de posts (artículos).
 * @module PostsModule
 * ============================================================================
 *
 * MEMORIA TÉCNICA:
 * Este servicio maneja la persistencia de los posts. Se encarga de las
 * operaciones CRUD básicas. La lógica de autorización ABAC se invoca
 * desde los controladores o servicios de mayor nivel utilizando el
 * AuthorizationService (antes PermissionService).
 */
@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crea un nuevo post.
   * @param data Datos del post (title, content, authorId, etc.)
   */
  async create(data: Prisma.PostUncheckedCreateInput): Promise<Post> {
    return this.prisma.post.create({
      data,
    });
  }

  /**
   * Obtiene todos los posts (lista general).
   */
  async findAll(): Promise<Post[]> {
    return this.prisma.post.findMany();
  }

  /**
   * Busca un post específico por su ID.
   * @param id ID del post.
   * @throws NotFoundException si no existe.
   */
  async findOne(id: number): Promise<Post> {
    const post = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      throw new NotFoundException(`Post con ID ${id} no encontrado`);
    }

    return post;
  }

  /**
   * Actualiza un post existente.
   * @param id ID del post.
   * @param data Datos a actualizar.
   */
  async update(id: number, data: Prisma.PostUpdateInput): Promise<Post> {
    // Validamos existencia antes de actualizar
    await this.findOne(id);

    return this.prisma.post.update({
      where: { id },
      data,
    });
  }

  /**
   * Elimina un post de la base de datos.
   * @param id ID del post a eliminar.
   */
  async remove(id: number): Promise<Post> {
    // Validamos existencia antes de borrar
    await this.findOne(id);

    return this.prisma.post.delete({
      where: { id },
    });
  }
}
