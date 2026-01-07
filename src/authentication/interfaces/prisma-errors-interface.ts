/**
 * INTERFAZ: PrismaErrorMeta
 * Define la estructura compleja que Prisma puede devolver en su propiedad 'meta',
 * incluyendo el camino específico para Driver Adapters (como SQLite) donde los
 * errores de restricción se anidan profundamente.
 */
export interface PrismaErrorMeta {
  target?: string | string[];
  field_name?: string;
  modelName?: string;
  cause?: string;
  driverAdapterError?: {
    cause?: {
      constraint?: {
        fields?: string[];
      };
    };
  };
}
