/**
 * INTERFAZ: StandardResponse<T>
 * Define la estructura unificada de todas las respuestas exitosas de la API.
 * El uso del genérico <T> permite que 'data' sea flexible (un objeto, un array, etc.)
 * manteniendo siempre la seguridad de tipos.
 */
export interface StandardResponse<T> {
  /**
   * Indica que la operación fue procesada correctamente.
   * Siempre será 'true' para las respuestas manejadas por el Interceptor.
   */
  success: boolean;

  /**
   * Código de estado HTTP (ej: 200, 201, 204).
   * Proporciona al cliente una forma rápida de verificar el resultado
   * dentro del cuerpo del JSON sin consultar los headers.
   */
  statusCode: number;

  /**
   * El cuerpo principal de la respuesta.
   * Contiene los datos reales devueltos por el controlador (usuario, lista de items, etc.).
   */
  data: T;

  /**
   * Marca de tiempo en formato ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ).
   * Útil para auditoría, depuración y para que el cliente sepa qué tan
   * recientes son los datos.
   */
  timestamp: string;

  /**
   * La ruta (URL) exacta que fue consultada.
   * Ayuda al Frontend a identificar a qué petición pertenece esta respuesta
   * en flujos asíncronos complejos.
   */
  path: string;
}
