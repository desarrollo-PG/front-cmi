import { Injectable } from "@angular/core";
import Swal from "sweetalert2";

@Injectable({
  providedIn: 'root'
})
export class AlertaService {
  
  private cssInjected = false;

  constructor() {
    this.injectCSS();
  }

  private injectCSS(): void {
    if (!this.cssInjected) {
      const style = document.createElement('style');
      style.id = 'notification-service-styles';
      style.innerHTML = `
        /* Toast de error */
        .toast-error-border {
          border-left: 5px solid #f44336 !important;
          border-radius: 8px !important;
        }
        .toast-error-timer {
          background-color: #f44336 !important;
        }

        /* Toast de éxito */
        .toast-success-border {
          border-left: 5px solid #28a745 !important;
          border-radius: 8px !important;
        }
        .toast-success-timer {
          background-color: #28a745 !important;
        }

        /* Toast de advertencia */
        .toast-warning-border {
          border-left: 5px solid #ffc107 !important;
          border-radius: 8px !important;
        }
        .toast-warning-timer {
          background-color: #ffc107 !important;
        }
      `;
      
      // Verificar si ya existe para evitar duplicados
      const existingStyle = document.getElementById('notification-service-styles');
      if (!existingStyle) {
        document.head.appendChild(style);
        this.cssInjected = true;
      }
    }
  }
  
  alertaError(titulo: string): void {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        customClass: {
          popup: 'toast-error-border',
          timerProgressBar: 'toast-error-timer'
        },
        didOpen: (toast) => {
          toast.addEventListener('mouseenter', Swal.stopTimer)
          toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    });

    Toast.fire({
        icon: 'error',
        title: titulo
    });
  }
  
  alertaExito(titulo: string): void {
    Swal.fire({
      position: 'center',
      icon: 'success',
      title: titulo,
      showConfirmButton: false,
      timer: 1000
    });
  }
  
  alertaInfo(titulo: string): void {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        customClass: {
          popup: 'toast-info-border',
          timerProgressBar: 'toast-info-timer'
        },
        didOpen: (toast) => {
          toast.addEventListener('mouseenter', Swal.stopTimer)
          toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    });

    Toast.fire({
        icon: 'info',
        title: titulo
    });
  }
  
  alertaPreventiva(titulo: string): void {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        customClass: {
          popup: 'toast-warning-border', 
          timerProgressBar: 'toast-warning-timer'
        }
    });

    Toast.fire({
        icon: 'warning',
        title: titulo
    });
  }
  alertaConfirmacion(titulo: string, textoIni: string, tituloBtnCon: string, tituloBtnCan: string): Promise<boolean> {
    const swalWithBootstrapButtons = Swal.mixin({
      customClass: {
        confirmButton: "btn btn-success me-3",
        cancelButton: "btn btn-danger ms-3",
        actions: "gap-3"
      },
      buttonsStyling: false
    });

    return swalWithBootstrapButtons.fire({
      title: titulo,
      text: textoIni,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: tituloBtnCon,
      cancelButtonText: tituloBtnCan,
      reverseButtons: true
    }).then((result) => {
      return result.isConfirmed;
    });
  }
}