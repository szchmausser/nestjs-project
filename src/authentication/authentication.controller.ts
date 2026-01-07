import {
  Body,
  Controller,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import type { Response } from 'express';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { AUTH_COOKIE_NAME } from './constants/authentication.constants';

@Controller('auth')
export class AuthenticationController {
  constructor(private readonly authenticationService: AuthenticationService) {}

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return await this.authenticationService.register(registerDto);
  }

  @Public()
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 1. Intentamos validar al usuario.
    const user = await this.authenticationService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    // 2. Manejo de errores profesional:
    // Si el usuario no existe o la clave es incorrecta, lanzamos UnauthorizedException.
    // NestJS lo convertirá automáticamente en un error 401 para el cliente.
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 3. Generamos el token JWT.
    const { access_token } = this.authenticationService.login(user);

    // 4. Guardamos el token en una Cookie.
    // He mantenido 'Authentication' como nombre, pero asegúrate que sea igual en el logout.
    res.cookie(AUTH_COOKIE_NAME, access_token, {
      httpOnly: true, // Impide que JavaScript acceda a la cookie (Protección XSS)
      secure: true, // Solo se envía por HTTPS (imprescindible en prod)
      sameSite: 'strict', // Evita ataques CSRF
      maxAge: 1000 * 60 * 60 * 24, // Recomendable poner una expiración (ej: 1 día)
    });

    // 5. Devolvemos respuesta de éxito y los datos del usuario (que ya vienen sin password).
    return {
      message: 'Login exitoso',
      user,
    };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    // 1. Llamamos al servicio (si tienes lógica ahí, como logs o blacklist)
    this.authenticationService.logout();

    // 2. Borramos la cookie del navegador.
    res.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });

    // 3. Enviamos la respuesta de éxito
    return { message: 'Sesión cerrada correctamente' };
  }
}
