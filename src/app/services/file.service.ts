// src/app/services/file.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface FileUploadResponse {
  success: boolean;
  message: string;
  data?: {
    fileName: string;
    filePath: string;
    fileUrl: string;
    tipo: string;
    pacienteId: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class FileService {
  private apiUrl = `${environment.apiUrl}/files`;

  constructor(private http: HttpClient) {
    console.log('🗂️ FileService inicializado');
    console.log('🗂️ API URL:', this.apiUrl);
  }

  /**
   * Subir archivo al servidor
   */
  uploadFile(file: File, pacienteId: number, tipo: 'perfil' | 'encargado' | 'carta'): Observable<FileUploadResponse> {
    console.log('\n📤 === UPLOAD ===');
    console.log('Archivo:', file.name, `(${file.size} bytes)`);
    console.log('Paciente ID:', pacienteId);
    console.log('Tipo:', tipo);

    // Validar archivo
    const validation = this.validateFile(file, tipo);
    if (!validation.valid) {
      console.error('❌ Archivo inválido:', validation.message);
      return throwError(() => new Error(validation.message || 'Archivo no válido'));
    }

    // Crear FormData
    const formData = new FormData();
    formData.append('file', file);
    formData.append('pacienteId', pacienteId.toString());
    formData.append('tipo', tipo);

    console.log('🚀 Enviando a:', `${this.apiUrl}/upload`);

    return this.http.post<FileUploadResponse>(`${this.apiUrl}/upload`, formData).pipe(
      tap(response => {
        console.log('✅ Upload exitoso:', response);
      }),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * Validar archivo
   */
  validateFile(file: File, tipo: 'perfil' | 'encargado' | 'carta'): { valid: boolean; message?: string } {
    if (!file) {
      return { valid: false, message: 'No se proporcionó archivo' };
    }

    // Validar tamaño (máximo 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const sizeMB = Math.round(file.size / (1024 * 1024) * 100) / 100;
      return { valid: false, message: `Archivo muy grande (${sizeMB}MB). Máximo: 5MB` };
    }

    // Validar tipo
    const allowedTypes: { [key: string]: string[] } = {
      'perfil': ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
      'encargado': ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
      'carta': ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
    };

    if (!allowedTypes[tipo].includes(file.type)) {
      const allowedExts = tipo === 'carta' ? 'JPG, PNG, GIF, WEBP, PDF' : 'JPG, PNG, GIF, WEBP';
      return { valid: false, message: `Tipo no permitido para ${tipo}. Use: ${allowedExts}` };
    }

    return { valid: true };
  }

  /**
   * Generar vista previa
   */
  getFilePreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (file.type === 'application/pdf') {
        // Para PDF retornar icono
        resolve('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDEyaDMydjQwSDEyeiIgZmlsbD0iI0VGNDQ0NCIvPgo8dGV4dCB4PSIzMiIgeT0iMzYiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlBERjwvdGV4dD4KPC9zdmc+');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Error al leer archivo'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Obtener URL de archivo
   */
  getFileUrl(fileName: string): string {
    if (!fileName) return '';
    return `${this.apiUrl}/view/${encodeURIComponent(fileName)}`;
  }

  /**
   * Obtener URL desde ruta
   */
  getFileUrlFromPath(filePath: string): string {
    if (!filePath) return '';
    const fileName = filePath.split(/[/\\]/).pop();
    return fileName ? this.getFileUrl(fileName) : '';
  }

  /**
   * Formatear tamaño de archivo
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Manejo de errores
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('❌ Error en upload:', error);
    
    let message = 'Error al subir archivo';
    
    if (error.status === 0) {
      message = 'Error de conexión';
    } else if (error.status === 413) {
      message = 'Archivo muy grande';
    } else if (error.status === 415) {
      message = 'Tipo de archivo no soportado';
    } else if (error.error?.message) {
      message = error.error.message;
    }

    return throwError(() => new Error(message));
  }
}