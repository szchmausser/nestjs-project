export interface JwtPayload {
  sub: number; // ID del usuario
  email: string; // Email del usuario
  iat?: number; // Issued at (fecha creación)
  exp?: number; // Expiration (fecha expiración)
}
