import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from 'src/prisma/generated/prisma/client';
import type { User } from 'src/prisma/generated/prisma/client';
import { RegisterDto } from 'src/authentication/dto/register.dto';

/**
 * ============================================================================
 * @file users.service.ts
 * @description Servicio para la gestión de usuarios y perfiles.
 * @module UsersModule
 * ============================================================================
 *
 * MEMORIA TÉCNICA:
 * Este servicio centraliza todas las operaciones CRUD y de búsqueda de usuarios.
 * Se separa de la autenticación para permitir que otros módulos (como Posts o
 * Authorization) interactúen con los datos de usuario de forma aislada.
 */
@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crea un nuevo usuario en la base de datos.
   * @param data Datos del usuario (email, password encriptado, name, etc.)
   */
  async create(data: RegisterDto) {
    const user = await this.prisma.user.create({
      data,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  /**
   * Busca un usuario por su ID único.
   * @param id ID numérico del usuario.
   */
  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  /**
   * Busca un usuario por su correo electrónico.
   * Útil para procesos de login y validación de duplicados.
   * @param email Correo electrónico del usuario.
   */
  async findOneByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Actualiza los datos de un usuario existente.
   * @param id ID del usuario a actualizar.
   * @param data Datos a modificar.
   */
  async update(
    id: number,
    data: Prisma.UserUpdateInput,
  ): Promise<Omit<User, 'password'>> {
    const user = await this.prisma.user.update({
      where: { id },
      data,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  /**
   * Elimina (o marca como eliminado) un usuario.
   * NOTA: Según el schema, se prefiere el soft delete (deletedAt).
   * @param id ID del usuario.
   */
  async remove(id: number): Promise<Omit<User, 'password'>> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }
}
