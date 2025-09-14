import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { environment } from '../../environments/environment.development';

@Injectable({
  providedIn: 'root'
})
export class ArchivoService {
  private apiUrl = `${environment.apiUrl}/archivo`;

  constructor(private http: HttpClient) {}

  /**
   * MÉTODO PRINCIPAL GENÉRICO - Funciona para cualquier entidad
   * @param entidad - 'usuarios', 'pacientes', 'productos', etc.
   * @param entityId - ID de la entidad
   * @param archivos - { foto?: File, documento?: File }
   * @returns Promise con las rutas para guardar en BD
   */
  async subirArchivos(
    entidad: string,
    entityId: number,
    archivos: { foto?: File, documento?: File }
  ): Promise<{ rutaFoto?: string, rutaDocumento?: string }> {
    try {
      const formData = new FormData();
      formData.append('entityId', entityId.toString());

      if (archivos.foto) {
        if (!archivos.foto.type.startsWith('image/')) {
          throw new Error('Solo se permiten imágenes (JPG, PNG, WebP)');
        }
        if (archivos.foto.size > 5 * 1024 * 1024) {
          throw new Error('La foto no puede superar los 5MB');
        }
        formData.append('foto', archivos.foto);
      }

      if (archivos.documento) {
        if (archivos.documento.type !== 'application/pdf') {
          throw new Error('Solo se permiten archivos PDF');
        }
        if (archivos.documento.size > 10 * 1024 * 1024) {
          throw new Error('El documento no puede superar los 10MB');
        }
        formData.append('documento', archivos.documento);
      }

      // URL completamente genérica
      const response = await this.http.post<any>(`${this.apiUrl}/${entidad}/subirArchivos`, formData).toPromise();
      
      if (response.success) {
        return {
          rutaFoto: response.data.rutaFoto || undefined,
          rutaDocumento: response.data.rutaDocumento || undefined
        };
      } else {
        throw new Error(response.message || 'Error al subir archivos');
      }
    } catch (error: any) {
      throw new Error(error.message || 'Error al subir archivos');
    }
  }

  /**
   * MÉTODO PRINCIPAL GENÉRICO - Solo foto
   * @param entidad - 'usuarios', 'pacientes', 'productos', etc.
   * @param entityId - ID de la entidad
   * @param foto - Archivo de foto
   * @returns Promise con la ruta del archivo para guardar en BD
   */
  async subirFoto(entidad: string, entityId: number, foto: File): Promise<string> {
    try {
      if (!foto.type.startsWith('image/')) {
        throw new Error('Solo se permiten imágenes (JPG, PNG, WebP)');
      }
      
      if (foto.size > 5 * 1024 * 1024) {
        throw new Error('La foto no puede superar los 5MB');
      }

      const formData = new FormData();
      formData.append('foto', foto);
      formData.append('entityId', entityId.toString());

      const response = await this.http.post<any>(`${this.apiUrl}/${entidad}/subirFoto`, formData).toPromise();
      
      if (response.success) {
        return response.data.rutaArchivo;
      } else {
        throw new Error(response.message || 'Error al subir foto');
      }
    } catch (error: any) {
      throw new Error(error.message || 'Error al subir foto');
    }
  }

  /**
   * MÉTODO PRINCIPAL GENÉRICO - Solo documento
   * @param entidad - 'usuarios', 'pacientes', 'productos', etc.
   * @param entityId - ID de la entidad
   * @param documento - Archivo PDF
   * @returns Promise con la ruta del archivo para guardar en BD
   */
  async subirDocumento(entidad: string, entityId: number, documento: File): Promise<string> {
    try {
      if (documento.type !== 'application/pdf') {
        throw new Error('Solo se permiten archivos PDF');
      }
      
      if (documento.size > 10 * 1024 * 1024) {
        throw new Error('El documento no puede superar los 10MB');
      }

      const formData = new FormData();
      formData.append('documento', documento);
      formData.append('entityId', entityId.toString());

      const response = await this.http.post<any>(`${this.apiUrl}/${entidad}/subirDocumento`, formData).toPromise();
      
      if (response.success) {
        return response.data.rutaArchivo;
      } else {
        throw new Error(response.message || 'Error al subir documento');
      }
    } catch (error: any) {
      throw new Error(error.message || 'Error al subir documento');
    }
  }

  // ============================================================================
  // MÉTODOS UTILITARIOS (genéricos para cualquier entidad)
  // ============================================================================

  /**
   * Convierte ruta de BD a URL pública
   * @param rutaArchivo - Ruta guardada en BD
   * @returns URL pública para mostrar en frontend
   */

  obtenerUrlPublica(rutaArchivo: string | null): string | null {
    if (!rutaArchivo || typeof rutaArchivo !== 'string') {
      return null;
    }
    
    const fileName = rutaArchivo.split('/').pop();
    if (!fileName) return null;
    
    return `${environment.apiUrl}/files/${fileName}`;
  }

  /**
   * Convierte múltiples rutas a URLs públicas
   * Funciona para cualquier entidad que tenga rutafotoperfil y rutadocumento
   */
  obtenerUrlsPublicas(entidad: any): any {
    return {
      ...entidad,
      fotoUrl: this.obtenerUrlPublica(entidad.rutafotoperfil),
      documentoUrl: this.obtenerUrlPublica(entidad.rutadocumento)
    };
  }

  /**
   * Elimina archivo genérico
   * @param rutaArchivo - Ruta del archivo en BD
   */
  async eliminarArchivo(rutaArchivo: string): Promise<void> {
    try {
      const response = await this.http.delete<any>(`${this.apiUrl}/eliminar`, {
        body: { rutaArchivo }
      }).toPromise();
      
      if (!response.success) {
        throw new Error(response.message || 'Error al eliminar archivo');
      }
    } catch (error: any) {
      throw new Error(error.message || 'Error al eliminar archivo');
    }
  }

  /**
   * Crea vista previa de imagen
   */
  async crearVistaPrevia(archivo: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!archivo.type.startsWith('image/')) {
        reject(new Error('El archivo no es una imagen'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Error leyendo archivo'));
      reader.readAsDataURL(archivo);
    });
  }

  /**
   * Formatea tamaño de archivo
   */
  formatearTamaño(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Valida archivo antes de subir
   */
  validarArchivo(archivo: File, tipo: 'image' | 'document', maxSizeMB: number = 10): { valido: boolean, error?: string } {
    if (tipo === 'image') {
      if (!archivo.type.startsWith('image/')) {
        return { valido: false, error: 'Solo se permiten imágenes (JPG, PNG, WebP)' };
      }
    } else if (tipo === 'document') {
      if (archivo.type !== 'application/pdf') {
        return { valido: false, error: 'Solo se permiten archivos PDF' };
      }
    }

    const maxBytes = maxSizeMB * 1024 * 1024;
    if (archivo.size > maxBytes) {
      return { valido: false, error: `El archivo no puede superar los ${maxSizeMB}MB` };
    }

    return { valido: true };
  }
}