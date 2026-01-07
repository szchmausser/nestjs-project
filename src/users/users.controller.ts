import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserPayload } from '../authentication/interfaces/user-payload.interface';

/**
 * ============================================================================
 * @file users.controller.ts
 * @description Controlador para gestionar perfiles de usuario.
 * @module UsersModule
 * ============================================================================
 *
 * MEMORIA TÉCNICA:
 * Provee los endpoints necesarios para que los usuarios consulten su propia
 * información o, con los permisos adecuados, la de otros usuarios.
 */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Obtiene el perfil del usuario actualmente autenticado (yo).
   * @param user Datos extraídos del JWT.
   */
  @Get('me')
  getMe(@CurrentUser() user: UserPayload) {
    return this.usersService.findOne(user.id);
  }

  /**
   * Obtiene la información de un usuario específico por su ID.
   * @param id ID del usuario a consultar.
   */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }
}
