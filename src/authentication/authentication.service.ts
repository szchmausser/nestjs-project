import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { UserPayload } from './interfaces/user-payload.interface';
// import { Prisma } from 'generated/prisma/client';

@Injectable()
export class AuthenticationService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    // 1. Obtenemos datos del DTO.
    const { email, name, password } = registerDto;

    // 2. Encriptamos la contraseña. 10 es el "coste" (salt rounds).
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Guardamos en BD utilizando el servicio de usuarios.
    // UsersService.create ya retorna el usuario sin la contraseña.
    const user = await this.usersService.create({
      email,
      name,
      password: hashedPassword,
    });

    // 4. Devolvemos los datos del usuario.
    return user;
  }

  async validateUser(email: string, pass: string): Promise<UserPayload | null> {
    // 1. Buscamos al usuario utilizando el servicio de usuarios por su email
    const user = await this.usersService.findOneByEmail(email);

    // 2. Si el usuario no existe, salimos temprano (Early Return)
    if (!user) {
      return null;
    }

    // 3. Comparamos la contraseña recibida con la encriptada en la BD
    const isPasswordValid = await bcrypt.compare(pass, user.password);

    // 4. Si la contraseña no coincide, devolvemos null
    if (!isPasswordValid) {
      return null;
    }

    // 5. Si llegamos aquí, el usuario es válido. Extraemos los datos del usuario removiendo la contraseña.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...rest } = user;

    // 6. Devolvemos los datos del usuario sin la contraseña.
    return rest;
  }

  /**
   * Genera un JSON Web Token (JWT) para un usuario autenticado.
   * @param user Objeto de usuario (generalmente proveniente de validateUser).
   * @returns Un objeto que contiene el access_token firmado.
   */
  login(user: UserPayload) {
    // 1. Preparamos el 'payload' (la carga útil del token).
    // Usamos el estándar JWT: 'sub' (subject) para el ID y 'email' para identidad.
    const payload = {
      email: user.email,
      sub: user.id,
    };

    // 2. Firmamos el token usando JwtService.
    // Esto utiliza la clave secreta y configuración definida en el módulo.
    const accessToken = this.jwtService.sign(payload);

    // 3. Retornamos el token siguiendo la convención de nombres de OAuth2.
    return {
      access_token: accessToken,
    };
  }

  /**
   * Ejecuta la lógica de negocio necesaria para el cierre de sesión.
   * * NOTA: En una estrategia JWT Stateless, el servidor no necesita invalidar el token.
   * La eliminación física de la cookie se gestiona en el Controller por ser una tarea
   * puramente de transporte (HTTP). Se mantiene este método para futuras implementaciones
   * de lógica de negocio (ej. Invalidar Refresh Tokens en BD o registrar auditoría).
   */
  logout() {
    // Espacio reservado para lógica futura:
    // await this.usersService.revokeToken(userId);
    return;
  }

  // manualFireExceptionTest() {
  // ----------------------------------------------------------------
  // BLOQUE DE PRUEBA TEMPORAL PARA DISPARAR MANUALMENTE UN ERROR DE PRISMA
  // ----------------------------------------------------------------
  // throw new Prisma.PrismaClientKnownRequestError('Simulación de duplicado', {
  //   code: 'P2003',
  //   clientVersion: '7.2.0',
  //   meta: {
  //     modelName: 'User',
  //     driverAdapterError: {
  //       cause: {
  //         constraint: { fields: ['email'] },
  //       },
  //     },
  //   },
  // });
  // throw new Prisma.PrismaClientKnownRequestError('No encontrado', {
  //   code: 'P2025',
  //   clientVersion: '7.2.0',
  //   meta: { modelName: 'Producto', cause: 'Record not found' },
  // });
  // throw new Prisma.PrismaClientKnownRequestError('Fallo de relación', {
  //   code: 'P2003',
  //   clientVersion: '7.2.0',
  //   meta: { field_name: 'categoriaId', modelName: 'Producto' },
  // });
  // throw new Prisma.PrismaClientInitializationError(
  //   'Error de conexión',
  //   '7.2.0',
  //   'P1001',
  // );
  // throw new Prisma.PrismaClientValidationError(
  //   'Datos inconsistentes con el modelo',
  //   {
  //     clientVersion: '7.2.0',
  //   },
  // );
  // throw new Prisma.PrismaClientKnownRequestError('Valor inválido', {
  //   code: 'P2005',
  //   clientVersion: '7.2.0',
  //   meta: {
  //     modelName: 'Producto',
  //     field_name: 'precio', // <--- Aquí es donde tu filtro busca el dato
  //   },
  // });
  // throw new Prisma.PrismaClientKnownRequestError('Valor inválido', {
  //   code: 'P2006',
  //   clientVersion: '7.2.0',
  //   meta: {
  //     modelName: 'Producto',
  //     field_name: 'precio', // <--- Aquí es donde tu filtro busca el dato
  //   },
  // });
  // ----------------------------------------------------------------
  // Fin del bloque de prueba
  // ----------------------------------------------------------------
  // }
}
