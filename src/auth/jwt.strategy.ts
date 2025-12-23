import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AUTH_COOKIE_NAME } from './constants/auth.constants';
import { UserPayload } from './interfaces/user-payload.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    // Definimos la configuración básica para Passport
    super({
      /**
       * FLUJO DE EXTRACCIÓN (Detective Passport):
       * 1. Revisa extractJWT: Si retorna null, no falla, pasa al siguiente.
       * 2. Revisa BearerToken: Si ambos son null, Passport lanza 401 y detiene el flujo.
       * El método 'validate' solo se ejecuta si algún extractor encuentra un token válido.
       */
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Primero: Intentamos extraerlo de la cookie personalizada
        (req: Request) => {
          return JwtStrategy.extractJWT(req);
        },
        // Segundo: Como respaldo, permitimos el estándar de Header 'Bearer'
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      // 2. No ignoramos la expiración; si el token venció, Passport lanzará un 401
      ignoreExpiration: false,
      // 3. La clave secreta para verificar que el token es legítimo
      secretOrKey: process.env.JWT_SECRET || 'secretKey',
    });
  }

  /**
   * SEGURIDAD TÉCNICA: Valida la integridad de la petición (cookies presentes/formateadas)
   * para evitar excepciones (crash) antes de intentar extraer el token.
   */
  private static extractJWT(req: Request): string | null {
    // A. Verificamos que existan cookies en la petición
    const hasCookies = req.cookies && typeof req.cookies === 'object';

    if (!hasCookies) {
      return null;
    }

    // B. Verificamos que nuestra cookie específica esté presente
    const tokenExists = AUTH_COOKIE_NAME in req.cookies;

    if (!tokenExists) {
      return null;
    }

    // C. Retornamos el valor de la cookie asegurando que sea un string
    const token = req.cookies[AUTH_COOKIE_NAME] as string;

    return token;
  }

  /**
   * TRANSFORMACIÓN: Una vez verificada la firma del JWT, convertimos el
   * payload crudo en el objeto 'UserPayload' que NestJS inyectará en req.user.
   */
  validate(payload: JwtPayload): UserPayload {
    // 1. Extraemos los datos que nos interesan del contenido del token
    const userId = payload.sub;
    const userEmail = payload.email;

    // 2. Construimos el objeto que NestJS inyectará en 'req.user'
    const user: UserPayload = {
      id: userId,
      email: userEmail,
    };

    // 3. Al retornar este objeto, Passport lo deja disponible en toda la app
    return user;
  }
}
