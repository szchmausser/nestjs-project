import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UserPayload } from '../interfaces/user-payload.interface';

/**
 * GUARD: JwtAuthGuard
 * Este guard extiende el comportamiento de Passport para integrarlo con NestJS.
 * Su función es decidir si una petición puede continuar o debe ser rechazada.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * Determina si la ruta actual debe ser protegida o es de libre acceso.
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // 1. BUSCAR METADATOS: Revisa si el controlador o el método tienen el decorador @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), // Revisa el método (ej: getProfile)
      context.getClass(), // Revisa la clase (ej: AppController)
    ]);

    // 2. EXCEPCIÓN: Si es público, permitimos el paso sin validar el JWT
    if (isPublic) {
      return true;
    }

    // 3. VALIDACIÓN: Si no es público, llamamos a la lógica interna de AuthGuard('jwt')
    // Esto disparará automáticamente la extracción del token y la 'JwtStrategy'.
    return super.canActivate(context);
  }

  /**
   * Personaliza la respuesta cuando Passport termina de procesar el token.
   * @param err Error lanzado durante la validación técnica.
   * @param user El objeto devuelto por el método 'validate' de la estrategia.
   * @param info Información extra (ej: errores de token expirado).
   */

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleRequest<TUser = UserPayload>(err: any, user: TUser, _info: any): TUser {
    // A. Si hubo un error técnico o el usuario no existe (token inválido o ausente)
    if (err || !user) {
      /**
       * MEMORIA TÉCNICA:
       * Si 'info' contiene un error de expiración, podrías personalizar el mensaje aquí.
       * Por defecto, lanzamos 401 Unauthorized.
       */
      throw (
        err ||
        new UnauthorizedException(
          'Acceso no autorizado: Token inválido o ausente',
        )
      );
    }

    // B. Si todo está bien, retornamos el usuario.
    // NestJS lo guardará automáticamente en 'req.user'.
    return user;
  }
}
