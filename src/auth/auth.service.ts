import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { UserPayload } from './interfaces/user-payload.interface';
import { Prisma } from 'generated/prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<UserPayload> {
    // 1. Obtenemos datos del DTO.
    const { email, password } = registerDto;

    // 2. Encriptamos la contraseña. 10 es el "coste" (salt rounds).
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Guardamos en BD.
    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
        },
      });

      // 4. Extraemos los datos del usuario removiendo la contraseña.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...rest } = user;

      // 5. Devolvemos los datos del usuario sin la contraseña.
      return rest;
    } catch (error) {
      /**
       * MANEJO DE EXCEPCIONES ESPECÍFICAS DE PRISMA
       * P2002: Código de error de Prisma para violación de restricción única (Unique Constraint).
       */
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            `El correo electrónico '${email}' ya se encuentra registrado.`,
          );
        }
      }

      /**
       * ERROR GENÉRICO
       * Si el error no es por duplicado, lanzamos un 500 estándar para no
       * exponer detalles técnicos de la base de datos al cliente.
       */
      throw new InternalServerErrorException(
        'Ocurrió un error inesperado al intentar crear el usuario.',
      );
    }
  }

  async validateUser(email: string, pass: string): Promise<UserPayload | null> {
    // 1. Buscamos al usuario en la base de datos por su email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

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
}
