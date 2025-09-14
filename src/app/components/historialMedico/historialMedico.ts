// components/historialMedico/historialMedico.component.ts - VERSIÓN ACTUALIZADA
import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { 
  HistorialMedicoService, 
  HistorialMedico, 
  InfoPaciente,
  CrearSesionRequest,
  ActualizarSesionRequest 
} from '../../services/historialMedico.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { AlertaService } from '../../services/alerta.service';

@Component({
  selector: 'app-historial-medico',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, SidebarComponent],
  templateUrl: './historialMedico.html',
  styleUrls: ['./historialMedico.scss']
})
export class HistorialMedicoComponent implements OnInit, AfterViewInit {
  currentView: 'historial' | 'nueva-sesion' | 'diagnostico' = 'historial';
  sidebarExpanded = true;
  loading = false;
  
  idPaciente: number = 0;
  infoPaciente: InfoPaciente | null = null;
  historialSesiones: HistorialMedico[] = [];
  sesionActual: HistorialMedico | null = null;
  userInfo: any = {};
  currentDate = new Date();
  
  sesionForm: FormGroup;
  diagnosticoForm: FormGroup;
  
  selectedFiles: FileList | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    public historialService: HistorialMedicoService,
    private alerta: AlertaService
  ) {
    // ✅ FORMULARIO ACTUALIZADO con todos los campos
    this.sesionForm = this.fb.group({
      motivoconsulta: ['', [Validators.required, Validators.minLength(10)]],
      notaconsulta: [''], // Campo opcional
      recordatorio: [''], // Campo opcional
      evolucion: [''], // Campo opcional pero incluido
      diagnosticotratamiento: [''] // Campo opcional pero incluido
    });

    this.diagnosticoForm = this.fb.group({
      evolucion: [''],
      diagnosticotratamiento: ['']
    });
  }

  ngOnInit(): void {
    this.loadUserInfo();
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.idPaciente = parseInt(id);
        this.cargarDatosPaciente();
      }
    });
  }

  ngAfterViewInit(): void {
    this.detectSidebarState();
  }

  loadUserInfo(): void {
    try {
      const usuarioData = localStorage.getItem('usuario');
      if (usuarioData) {
        const usuario = JSON.parse(usuarioData);
        this.userInfo = {
          name: `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim(),
          avatar: usuario.avatar || null
        };
      }
    } catch (error) {
      console.error('Error al cargar información del usuario:', error);
    }
  }

  detectSidebarState(): void {
    const checkSidebar = () => {
      const sidebar = document.querySelector('.sidebar-container');
      if (sidebar) {
        this.sidebarExpanded = sidebar.classList.contains('expanded');
      }
    };

    setTimeout(checkSidebar, 100);

    const observer = new MutationObserver(checkSidebar);
    const sidebar = document.querySelector('.sidebar-container');
    
    if (sidebar) {
      observer.observe(sidebar, {
        attributes: true,
        attributeFilter: ['class']
      });
    }
  }

cargarDatosPaciente(): void {
  this.loading = true;
  
  // Intentar obtener datos del sessionStorage
  const datosPacienteStr = sessionStorage.getItem('datosPacienteHistorial');
  
  if (datosPacienteStr) {
    try {
      const datosFromPacientes = JSON.parse(datosPacienteStr);
      
      // Transformar los datos del formato de Paciente al formato de InfoPaciente
      this.infoPaciente = {
        idpaciente: datosFromPacientes.idpaciente,
        nombres: datosFromPacientes.nombres,
        apellidos: datosFromPacientes.apellidos,
        cui: datosFromPacientes.cui,
        fechanacimiento: datosFromPacientes.fechanacimiento,
        expedientes: datosFromPacientes.expedientes || []
      };
      
      // Limpiar sessionStorage después de usar los datos
      sessionStorage.removeItem('datosPacienteHistorial');
      
      this.loading = false;
      this.cargarHistorial();
      return;
      
    } catch (error) {
      console.error('Error parseando datos del paciente desde sessionStorage:', error);
    }
  }
  
  // Fallback: Si no hay datos en sessionStorage, intentar cargar del backend
  this.historialService.obtenerInfoPaciente(this.idPaciente).subscribe({
    next: (info: InfoPaciente) => {
      this.infoPaciente = info;
      this.cargarHistorial();
    },
    error: (error: any) => {
      console.error('Error cargando info del paciente:', error);
      this.loading = false;
      this.alerta.alertaError('Error al cargar información del paciente');
    }
  });
}

  cargarHistorial(): void {
    this.historialService.obtenerHistorialPorPaciente(this.idPaciente).subscribe({
      next: (historial: HistorialMedico[]) => {
        this.historialSesiones = historial;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error cargando historial:', error);
        this.loading = false;
        this.alerta.alertaError('Error al cargar el historial médico');
      }
    });
  }

  mostrarHistorial(): void {
    this.currentView = 'historial';
    this.resetForms();
  }

  mostrarNuevaSesion(): void {
    this.currentView = 'nueva-sesion';
    this.resetForms();
  }

  mostrarDiagnostico(sesion: HistorialMedico): void {
    this.sesionActual = sesion;
    this.currentView = 'diagnostico';
    
    this.diagnosticoForm.patchValue({
      evolucion: sesion.evolucion || '',
      diagnosticotratamiento: sesion.diagnosticotratamiento || ''
    });
  }

  resetForms(): void {
    this.sesionForm.reset();
    this.diagnosticoForm.reset();
    this.sesionActual = null;
    this.selectedFiles = null;
  }

  isFieldInvalid(form: FormGroup, fieldName: string): boolean {
    const field = form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(form: FormGroup, fieldName: string): string {
    const field = form.get(fieldName);
    if (field && field.errors && (field.dirty || field.touched)) {
      if (field.errors['required']) {
        return `${this.getFieldDisplayName(fieldName)} es requerido`;
      }
      if (field.errors['minlength']) {
        return `Mínimo ${field.errors['minlength'].requiredLength} caracteres`;
      }
    }
    return '';
  }

  private getFieldDisplayName(fieldName: string): string {
    const fieldNames: { [key: string]: string } = {
      'motivoconsulta': 'Motivo de consulta',
      'notaconsulta': 'Notas de la sesión',
      'recordatorio': 'Recordatorio',
      'evolucion': 'Evolución',
      'diagnosticotratamiento': 'Diagnóstico y tratamiento'
    };
    return fieldNames[fieldName] || fieldName;
  }

  // ✅ MÉTODO ACTUALIZADO para incluir todos los campos
  crearSesion(): void {
    if (this.sesionForm.valid && this.infoPaciente) {
      this.loading = true;
      
      const usuarioData = localStorage.getItem('usuario');
      if (!usuarioData) {
        this.alerta.alertaError('No se encontró información del usuario');
        this.loading = false;
        return;
      }

      const usuario = JSON.parse(usuarioData);
      const formData = this.sesionForm.value;
      
      // ✅ INCLUIR TODOS LOS CAMPOS que espera el backend
      const nuevaSesion: CrearSesionRequest = {
        fkpaciente: this.idPaciente,
        fkusuario: usuario.idusuario,
        fecha: new Date().toISOString(),
        motivoconsulta: formData.motivoconsulta,
        notaconsulta: formData.notaconsulta || '',
        recordatorio: formData.recordatorio || '',
        evolucion: formData.evolucion || '',
        diagnosticotratamiento: formData.diagnosticotratamiento || ''
      };


      this.historialService.crearSesion(nuevaSesion).subscribe({
        next: (sesionCreada: HistorialMedico) => {
          this.loading = false;
          this.alerta.alertaExito('Sesión creada correctamente');
          this.cargarHistorial();
          this.mostrarHistorial();
        },
        error: (error: any) => {
          console.error('Error creando sesión:', error);
          this.loading = false;
          
          let mensaje = 'Error al crear la sesión';
          if (error.error && error.error.message) {
            mensaje = error.error.message;
          }
          
          this.alerta.alertaError(mensaje);
        }
      });
    } else {
      // ✅ Marcar todos los campos como tocados para mostrar errores
      this.marcarFormularioComoTocado(this.sesionForm);
      this.alerta.alertaPreventiva('Complete al menos el motivo de consulta');
    }
  }

  // ✅ MÉTODO AUXILIAR para marcar campos como tocados
  private marcarFormularioComoTocado(form: FormGroup): void {
    Object.keys(form.controls).forEach(key => {
      const control = form.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
  }

  guardarDiagnostico(): void {
    if (this.sesionActual) {
      this.loading = true;
      
      const formData = this.diagnosticoForm.value;
      
      const datosActualizacion: ActualizarSesionRequest = {
        evolucion: formData.evolucion || '',
        diagnosticotratamiento: formData.diagnosticotratamiento || ''
      };

      this.historialService.actualizarSesion(this.sesionActual.idhistorial, datosActualizacion).subscribe({
        next: (sesionActualizada: HistorialMedico) => {
          this.loading = false;
          this.alerta.alertaExito('Diagnóstico guardado correctamente');
          this.cargarHistorial();
          this.mostrarHistorial();
        },
        error: (error: any) => {
          console.error('Error actualizando diagnóstico:', error);
          this.loading = false;
          
          let mensaje = 'Error al guardar el diagnóstico';
          if (error.error && error.error.message) {
            mensaje = error.error.message;
          }
          
          this.alerta.alertaError(mensaje);
        }
      });
    }
  }

  onFilesSelected(event: any): void {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.selectedFiles = files;
    }
  }

  subirArchivos(): void {
    if (this.selectedFiles && this.selectedFiles.length > 0) {
      this.loading = true;
      
      this.historialService.subirArchivos(this.idPaciente, this.selectedFiles).subscribe({
        next: (response: any) => {
          this.loading = false;
          this.selectedFiles = null;
          const fileInput = document.getElementById('archivos') as HTMLInputElement;
          if (fileInput) fileInput.value = '';
          
          this.alerta.alertaExito('Archivos subidos correctamente');
        },
        error: (error: any) => {
          console.error('Error subiendo archivos:', error);
          this.loading = false;
          
          let mensaje = 'Error al subir archivos';
          if (error.error && error.error.message) {
            mensaje = error.error.message;
          }
          
          this.alerta.alertaError(mensaje);
        }
      });
    }
  }

  eliminarSesion(sesion: HistorialMedico): void {
    if (confirm('¿Está seguro que desea eliminar esta sesión?')) {
      this.loading = true;
      
      this.historialService.eliminarSesion(sesion.idhistorial).subscribe({
        next: () => {
          this.loading = false;
          this.alerta.alertaExito('Sesión eliminada correctamente');
          this.cargarHistorial();
        },
        error: (error: any) => {
          console.error('Error eliminando sesión:', error);
          this.loading = false;
          
          let mensaje = 'Error al eliminar sesión';
          if (error.error && error.error.message) {
            mensaje = error.error.message;
          }
          
          this.alerta.alertaError(mensaje);
        }
      });
    }
  }

  formatearFecha(fecha: string): string {
    return this.historialService.formatearFechaDisplay(fecha);
  }

  volver(): void {
    this.router.navigate(['/pacientes']);
  }
}