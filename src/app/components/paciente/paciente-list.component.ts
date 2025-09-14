import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ServicioPaciente, Paciente, RespuestaPaciente } from '../../services/paciente.service';
import { ServicioExpediente } from '../../services/expediente.service'; 
import { FileService, FileUploadResponse } from '../../services/file.service';
import { AlertaService } from '../../services/alerta.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { ExpedienteListaComponent } from '../expediente/expediente';
import { HostListener } from '@angular/core';

// Interfaz para la información del usuario
export interface InformacionUsuario {
  name?: string;
  nombres?: string;
  apellidos?: string;
  avatar?: string;
  rol?: string;
}



@Component({
  selector: 'app-paciente-lista',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    FormsModule, 
    SidebarComponent,
    ExpedienteListaComponent 
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './paciente-list.component.html',
  styleUrls: ['./paciente-list.component.scss']
})
export class PacienteListaComponent implements OnInit, AfterViewInit, OnDestroy {
  
  @ViewChild(ExpedienteListaComponent) componenteExpediente!: ExpedienteListaComponent;
  private destruir$ = new Subject<void>();

  // Listener para cerrar dropdown al hacer clic fuera
@HostListener('document:click', ['$event'])
onDocumentClick(event: Event): void {
  const target = event.target as HTMLElement;
  if (!target.closest('.menu-tres-puntos')) {
    this.menuAbierto = null;
  }
}
  
  // Estados de la aplicación
  vistaActual: 'lista' | 'formulario' | 'detalle' | 'modal-expediente' = 'lista';
  datosExpedientePaciente: any = null;
  formularioExpediente: FormGroup | null = null;
  modoEdicion = false;
  cargando = false;
  subiendoArchivos = false;

  //Paginación
   currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;
  totalItems = 0;
  paginatedPacientes: Paciente[] = []; 
  
  //math para usar el template
  Math = Math;

  // Datos principales
  pacientes: Paciente[] = [];
  pacientesFiltrados: Paciente[] = [];
  pacienteSeleccionado: Paciente | null = null;
  
  // Formulario
  formularioPaciente: FormGroup;
  
  // Variables de archivos (mantener compatibilidad con HTML)
  fotoSeleccionada: string | null = null;
  fotoEncargadoSeleccionada: string | null = null;
  cartaSeleccionada: string | null = null;
  esCartaPDF = false;
  
  dropdownAbierto: number | null = null;
  menuAbierto: number | null = null;

// Métodos para manejar el dropdown
toggleMenu(index: number): void {
  // Si el menú ya está abierto en este índice, cerrarlo
  if (this.menuAbierto === index) {
    this.menuAbierto = null;
  } else {
    // Cerrar cualquier menú abierto y abrir el nuevo
    this.menuAbierto = index;
  }
}

cerrarMenu(): void {
  this.menuAbierto = null;
}

cerrarDropdown(): void {
  this.dropdownAbierto = null;
}

  // Archivos seleccionados para subida
  private archivosSeleccionados: {
    perfil?: File;
    encargado?: File;
    carta?: File;
  } = {};
  
  // Búsqueda y paginación
  terminoBusqueda = '';
  private sujetoBusqueda = new Subject<string>();
  paginaActual = 1;
  tamanoPagina = 10;
  totalElementos = 0;
  totalPaginas = 0;
  
  // Interfaz de usuario
  fechaActual = new Date();
  barraLateralExpandida = true;
  informacionUsuario: InformacionUsuario = {
    name: 'Usuario',
    rol: 'Administrador',
    avatar: 'assets/img/avatar-default.png'
  };
  error = '';

  constructor(
    private servicioUsuario: ServicioPaciente,
    private servicioExpediente: ServicioExpediente,
    private fb: FormBuilder,
    private servicioAlerta: AlertaService,
    private servicioArchivo: FileService,
    private router: Router
  ) {
    this.formularioPaciente = this.crearFormulario();
    this.configurarBusqueda();
  }

  ngOnInit(): void {
    this.cargarInformacionUsuario();
    this.cargarPacientes();
  }

  ngAfterViewInit(): void {
    this.detectarEstadoBarraLateral();
  }

  ngOnDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
  }

  // ==========================================
  // CONFIGURACIÓN INICIAL
  // ==========================================

  /**
   * Crea el formulario reactivo para pacientes
   */
  crearFormulario(): FormGroup {
    return this.fb.group({
      nombres: ['', [Validators.required, Validators.minLength(2)]],
      apellidos: ['', [Validators.required, Validators.minLength(2)]],
      cui: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
      fechanacimiento: ['', Validators.required],
      genero: ['', Validators.required],
      tipoconsulta: ['', Validators.required],
      tipodiscapacidad: ['Ninguna'],
      telefonopersonal: [''],
      nombrecontactoemergencia: [''],
      telefonoemergencia: [''],
      nombreencargado: [''],
      dpiencargado: [''],
      telefonoencargado: [''],
      municipio: ['', Validators.required],
      aldea: [''],
      direccion: ['', Validators.required]
    });
  }

  /**
   * Configura la búsqueda con debounce
   */
  configurarBusqueda(): void {
    this.sujetoBusqueda
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destruir$))
      .subscribe(() => this.filtrarPacientes());
  }

  /**
   * Carga la información del usuario desde localStorage
   */
  cargarInformacionUsuario(): void {
    try {
      const datosUsuario = localStorage.getItem('usuario');
      if (datosUsuario) {
        const usuario = JSON.parse(datosUsuario);
        this.informacionUsuario = {
          name: `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim() || 'Usuario',
          nombres: usuario.nombres,
          apellidos: usuario.apellidos,
          avatar: usuario.avatar || usuario.foto || 'assets/img/avatar-default.png',
          rol: usuario.rol || 'Usuario'
        };
      }
    } catch (error) {
      console.error('Error al cargar información del usuario:', error);
      this.informacionUsuario = {
        name: 'Usuario',
        rol: 'Usuario',
        avatar: 'assets/img/avatar-default.png'
      };
    }
  }

  /**
   * Detecta el estado de la barra lateral
   */
  detectarEstadoBarraLateral(): void {
    const verificarBarraLateral = () => {
      const barraLateral = document.querySelector('.sidebar-container');
      if (barraLateral) {
        this.barraLateralExpandida = barraLateral.classList.contains('expanded');
      }
    };

    setTimeout(verificarBarraLateral, 100);

    // Observar cambios en el sidebar
    const observer = new MutationObserver(verificarBarraLateral);
    const sidebar = document.querySelector('.sidebar-container');
    
    if (sidebar) {
      observer.observe(sidebar, {
        attributes: true,
        attributeFilter: ['class']
      });
    }
  }

  // ==========================================
  // NAVEGACIÓN ENTRE VISTAS
  // ==========================================

  /**
   * Muestra la vista de lista
   */
  mostrarLista(): void {
    this.vistaActual = 'lista';
    this.reiniciarFormulario();
  }

  /**
   * Muestra el formulario para crear nuevo paciente
   */
  mostrarFormulario(): void {
    this.vistaActual = 'formulario';
    this.modoEdicion = false;
    this.reiniciarFormulario();
  }

  /**
   * Muestra los detalles de un paciente
   */
  verPaciente(paciente: Paciente): void {
    this.pacienteSeleccionado = paciente;
    this.vistaActual = 'detalle';
  }

  /**
   * Abre el formulario para editar un paciente
   */
  editarPaciente(paciente: Paciente): void {
    this.pacienteSeleccionado = paciente;
    this.modoEdicion = true;
    this.vistaActual = 'formulario';
    this.llenarFormulario(paciente);
    this.cargarFotosExistentes(paciente);
  }

  /**
   * Cierra el modal
   */
  cerrarModal(): void {
    this.vistaActual = 'lista';
    this.reiniciarFormulario();
  }

  /**
   * Reinicia el formulario a su estado inicial
   */
  reiniciarFormulario(): void {
    this.formularioPaciente.reset();
    this.formularioPaciente.patchValue({ tipodiscapacidad: 'Ninguna' });
    this.modoEdicion = false;
    this.pacienteSeleccionado = null;
    
    // Limpiar archivos
    this.archivosSeleccionados = {};
    this.fotoSeleccionada = null;
    this.fotoEncargadoSeleccionada = null;
    this.cartaSeleccionada = null;
    this.esCartaPDF = false;
    this.subiendoArchivos = false;
    this.error = '';
  }

  // ==========================================
  // GESTIÓN DE DATOS
  // ==========================================

  /**
   * Carga la lista de pacientes desde el servidor
   */
cargarPacientes(): void {
    this.cargando = true;
    this.error = '';

    this.servicioUsuario.obtenerTodosLosPacientes(this.paginaActual, this.tamanoPagina, this.terminoBusqueda)
      .pipe(takeUntil(this.destruir$))
      .subscribe({
        next: (respuesta: RespuestaPaciente) => {
          if (respuesta.exito && Array.isArray(respuesta.datos)) {
            this.pacientes = respuesta.datos;
            this.pacientesFiltrados = [...this.pacientes];
            
            // AGREGAR ESTA LÍNEA para inicializar la paginación
            this.updatePagination();
            
            if (respuesta.paginacion) {
              this.totalElementos = respuesta.paginacion.total;
              this.totalPaginas = respuesta.paginacion.totalPaginas;
              this.paginaActual = respuesta.paginacion.pagina;
            }
          } else {
            this.error = 'Error al cargar pacientes';
            this.pacientes = [];
            this.pacientesFiltrados = [];
            this.servicioAlerta.alertaError('Error al cargar pacientes');
          }
          this.cargando = false;
        },
        error: (error) => {
          console.error('Error cargando pacientes:', error);
          this.error = 'Error de conexión';
          this.cargando = false;
          this.pacientes = [];
          this.pacientesFiltrados = [];
          this.servicioAlerta.alertaError('Error de conexión');
        }
      });
  }

  /**
   * Filtra los pacientes según el término de búsqueda
   */
 filtrarPacientes(): void {
    if (!this.terminoBusqueda.trim()) {
      this.pacientesFiltrados = [...this.pacientes];
    } else {
      const termino = this.terminoBusqueda.toLowerCase();
      this.pacientesFiltrados = this.pacientes.filter(paciente =>
        paciente.nombres.toLowerCase().includes(termino) ||
        paciente.apellidos.toLowerCase().includes(termino) ||
        paciente.cui.toLowerCase().includes(termino) ||
        (paciente.telefonopersonal && paciente.telefonopersonal.toLowerCase().includes(termino))
      );
    }
    
    // AGREGAR ESTAS LÍNEAS
    this.currentPage = 1; // Resetear a primera página
    this.updatePagination();
  }


formatearTelefono(campo: string): void {
  let valor: string = this.formularioPaciente.get(campo)?.value || '';

  // Quitar todo lo que no sea número
  valor = valor.replace(/\D/g, '');

  // Si ya empieza con 502, lo quitamos (para evitar que el usuario lo escriba)
  if (valor.startsWith('502')) {
    valor = valor.substring(3);
  }

  // Limitar a 8 dígitos (números de Guatemala)
  if (valor.length > 8) {
    valor = valor.substring(0, 8);
  }

  // Formatear: +502-XXXX-XXXX
  let formateado = '';
  if (valor.length > 0) {
    if (valor.length <= 4) {
      formateado = `+502 ${valor}`;
    } else {
      formateado = `+502 ${valor.substring(0, 4)}-${valor.substring(4)}`;
    }
  }

  // Actualizar el campo en el formulario
  this.formularioPaciente.get(campo)?.setValue(formateado, { emitEvent: false });
}


  // ==========================================
  // OPERACIONES CRUD
  // ==========================================

  /**
   * Procesa el envío del formulario
   */
  async alEnviar(): Promise<void> {
    if (!this.formularioPaciente.valid) {
      this.marcarFormularioComoTocado(this.formularioPaciente);
      this.servicioAlerta.alertaPreventiva('Complete todos los campos requeridos');
      return;
    }

    this.cargando = true;
    this.error = '';

    try {
      const datosPaciente: Paciente = this.formularioPaciente.value;

      if (this.modoEdicion && this.pacienteSeleccionado?.idpaciente) {
        await this.actualizarPacienteConArchivos(this.pacienteSeleccionado.idpaciente, datosPaciente);
      } else {
        await this.crearPacienteConArchivos(datosPaciente);
      }
    } catch (error) {
      console.error('Error en envío:', error);
      this.error = error instanceof Error ? error.message : 'Error desconocido';
      this.servicioAlerta.alertaError(this.error);
      this.cargando = false;
    }
  }

  /**
   * Crea un nuevo paciente con archivos
   */
  private async crearPacienteConArchivos(datosPaciente: Paciente): Promise<void> {
    try {
      const respuesta = await this.servicioUsuario.crearPaciente(datosPaciente)
        .toPromise()
        .then(resp => {
          if (!resp) {
            throw new Error('No se recibió respuesta del servidor');
          }
          return resp;
        });
      
      if (respuesta.exito) {
        const nuevoPaciente = respuesta.datos as Paciente;
        const pacienteId = nuevoPaciente.idpaciente;
        
        if (pacienteId && this.tieneArchivosParaSubir()) {
          await this.subirTodosLosArchivos(pacienteId);
          this.servicioAlerta.alertaExito('Paciente creado con archivos');
        } else {
          this.servicioAlerta.alertaExito('Paciente creado exitosamente');
        }
        
        this.cargarPacientes();
        this.mostrarLista();
      } else {
        throw new Error(respuesta.mensaje || 'Error al crear paciente');
      }
    } catch (error) {
      throw error;
    } finally {
      this.cargando = false;
      this.subiendoArchivos = false;
    }
  }

  /**
   * Actualiza un paciente existente con archivos
   */
  private async actualizarPacienteConArchivos(pacienteId: number, datosPaciente: Paciente): Promise<void> {
    try {
      const respuesta = await this.servicioUsuario.actualizarPaciente(pacienteId, datosPaciente)
        .toPromise()
        .then(resp => {
          if (!resp) {
            throw new Error('No se recibió respuesta del servidor');
          }
          return resp;
        });
      
      if (respuesta.exito) {
        if (this.tieneArchivosParaSubir()) {
          await this.subirTodosLosArchivos(pacienteId);
          this.servicioAlerta.alertaExito('Paciente actualizado con archivos');
        } else {
          this.servicioAlerta.alertaExito('Paciente actualizado exitosamente');
        }
        
        this.cargarPacientes();
        this.mostrarLista();
      } else {
        throw new Error(respuesta.mensaje || 'Error al actualizar paciente');
      }
    } catch (error) {
      throw error;
    } finally {
      this.cargando = false;
      this.subiendoArchivos = false;
    }
  }

  /**
   * Verifica si hay archivos para subir
   */
  private tieneArchivosParaSubir(): boolean {
    return !!(this.archivosSeleccionados.perfil || this.archivosSeleccionados.encargado || this.archivosSeleccionados.carta);
  }

  /**
   * Sube todos los archivos seleccionados
   */
  private async subirTodosLosArchivos(pacienteId: number): Promise<void> {
    if (!this.tieneArchivosParaSubir()) {
      return;
    }

    this.subiendoArchivos = true;
    const promesasSubida: Promise<FileUploadResponse>[] = [];

    try {
      if (this.archivosSeleccionados.perfil) {
        const promesa = this.servicioArchivo.uploadFile(this.archivosSeleccionados.perfil, pacienteId, 'perfil')
          .toPromise()
          .then(response => {
            if (!response) {
              throw new Error('No se recibió respuesta del servidor');
            }
            return response;
          });
        promesasSubida.push(promesa);
      }

      if (this.archivosSeleccionados.encargado) {
        const promesa = this.servicioArchivo.uploadFile(this.archivosSeleccionados.encargado, pacienteId, 'encargado')
          .toPromise()
          .then(response => {
            if (!response) {
              throw new Error('No se recibió respuesta del servidor');
            }
            return response;
          });
        promesasSubida.push(promesa);
      }

      if (this.archivosSeleccionados.carta) {
        const promesa = this.servicioArchivo.uploadFile(this.archivosSeleccionados.carta, pacienteId, 'carta')
          .toPromise()
          .then(response => {
            if (!response) {
              throw new Error('No se recibió respuesta del servidor');
            }
            return response;
          });
        promesasSubida.push(promesa);
      }

      await Promise.all(promesasSubida);
      this.archivosSeleccionados = {};
      
    } catch (error) {
      console.error('Error subiendo archivos:', error);
      throw error;
    } finally {
      this.subiendoArchivos = false;
    }
  }

  /**
   * Elimina un paciente con confirmación
   */
  eliminarPaciente(id: number): void {
    Swal.fire({
      title: '¿Eliminar paciente?',
      text: "Esta acción no se puede deshacer",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((resultado: any) => {
      if (resultado.isConfirmed) {
        this.cargando = true;
        
        this.servicioUsuario.eliminarPaciente(id)
          .pipe(takeUntil(this.destruir$))
          .subscribe({
            next: (respuesta) => {
              if (respuesta.exito) {
                this.servicioAlerta.alertaExito('Paciente eliminado');
                this.cargarPacientes();
              } else {
                this.servicioAlerta.alertaError('Error al eliminar');
              }
              this.cargando = false;
            },
            error: () => {
              this.servicioAlerta.alertaError('Error al eliminar');
              this.cargando = false;
            }
          });
      }
    });
  }

  // ==========================================
  // GESTIÓN DE EXPEDIENTES MÉDICOS
  // ==========================================

  /**
   * Verifica si un paciente tiene expedientes
   */
  pacienteTieneExpedientes(paciente: Paciente): boolean {
    return !!(paciente.expedientes && paciente.expedientes.length > 0);
  }

  /**
   * Obtiene el primer expediente de un paciente
   */
  obtenerPrimerExpediente(paciente: Paciente): any | null {
    if (this.pacienteTieneExpedientes(paciente)) {
      return paciente.expedientes![0];
    }
    return null;
  }

  /**
   * Obtiene información del expediente para el template
   */
  obtenerInformacionExpedientePaciente(paciente: Paciente): { 
    tieneExpediente: boolean, 
    numeroExpediente?: string, 
    idExpediente?: number 
  } {
    const primerExpediente = this.obtenerPrimerExpediente(paciente);
    
    return {
      tieneExpediente: !!primerExpediente,
      numeroExpediente: primerExpediente?.numeroexpediente,
      idExpediente: primerExpediente?.idexpediente
    };
  }

  /**
   * Crear expediente para un paciente específico
   */
  crearExpedientePaciente(paciente: Paciente): void {
    Swal.fire({
      title: 'Crear Expediente Médico',
      html: `
        <p>¿Desea crear un expediente médico para:</p>
        <strong>${paciente.nombres} ${paciente.apellidos}</strong>
        <br><small>CUI: ${paciente.cui}</small>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d',
      confirmButtonText: '<i class="fas fa-plus"></i> Crear Expediente',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then((resultado: any) => {
      if (resultado.isConfirmed) {
        this.abrirModalExpediente(paciente);
      }
    });
  }

  /**
   * Ver expediente existente de un paciente
   */
  verExpedientePaciente(paciente: Paciente): void {
    const informacionExpediente = this.obtenerInformacionExpedientePaciente(paciente);
    
    if (!informacionExpediente.tieneExpediente) {
      this.servicioAlerta.alertaPreventiva('Este paciente no tiene expediente asignado');
      return;
    }

    this.servicioAlerta.alertaInfo(
      `Expediente: ${informacionExpediente.numeroExpediente} - Esta funcionalidad se implementará próximamente`
    );
  }

  /**
   * Abre el modal para crear expediente
   */
  private abrirModalExpediente(paciente: Paciente): void {
    this.datosExpedientePaciente = {
      idpaciente: paciente.idpaciente,
      pacienteInfo: {
        nombres: paciente.nombres,
        apellidos: paciente.apellidos,
        cui: paciente.cui,
        fechanacimiento: paciente.fechanacimiento,
        genero: paciente.genero
      }
    };

    this.vistaActual = 'modal-expediente';
    
    setTimeout(() => {
      if (this.componenteExpediente) {
        this.componenteExpediente.abrirModalDesdePacientes(this.datosExpedientePaciente);
      }
    }, 100);
  }

  /**
   * Cierra el modal de expediente
   */
  cerrarModalExpediente(datosExpediente?: any): void {
    if (datosExpediente) {
      this.servicioAlerta.alertaExito(
        `Expediente creado exitosamente. Número: ${datosExpediente.numeroExpediente}`
      );
      this.actualizarPacienteConExpediente(datosExpediente);
    }
    
    this.vistaActual = 'lista';
    this.datosExpedientePaciente = null;
    this.cargarPacientes();
  }

  /**
   * Actualiza la información local del paciente con nuevo expediente
   */
  private actualizarPacienteConExpediente(datosExpediente: any): void {
    if (!datosExpediente.pacienteId) {
      return;
    }
    
    const indicePaciente = this.pacientes.findIndex(p => p.idpaciente === datosExpediente.pacienteId);
    
    if (indicePaciente !== -1) {
      if (!this.pacientes[indicePaciente].expedientes) {
        this.pacientes[indicePaciente].expedientes = [];
      }
      
      const nuevoExpediente = {
        idexpediente: datosExpediente.idExpediente,
        numeroexpediente: datosExpediente.numeroExpediente,
        historiaenfermedad: datosExpediente.expediente?.historiaenfermedad || ''
      };
      
      this.pacientes[indicePaciente].expedientes!.push(nuevoExpediente);
      
      const indiceFiltrado = this.pacientesFiltrados.findIndex(p => p.idpaciente === datosExpediente.pacienteId);
      if (indiceFiltrado !== -1) {
        if (!this.pacientesFiltrados[indiceFiltrado].expedientes) {
          this.pacientesFiltrados[indiceFiltrado].expedientes = [];
        }
        
        this.pacientesFiltrados[indiceFiltrado].expedientes!.push(nuevoExpediente);
      }
      
      this.pacientesFiltrados = [...this.pacientesFiltrados];
    }
  }

  // ==========================================
  // GESTIÓN DE ARCHIVOS
  // ==========================================

  /**
   * Maneja la selección de fotos y documentos
   */
  async alSeleccionarFoto(evento: any, tipo: 'perfil' | 'encargado' | 'carta'): Promise<void> {
    const archivo = evento.target.files[0];
    if (!archivo) return;

    try {
      const validacion = this.servicioArchivo.validateFile(archivo, tipo);
      if (!validacion.valid) {
        this.servicioAlerta.alertaPreventiva(validacion.message || 'Archivo no válido');
        evento.target.value = '';
        return;
      }

      const vistaPrevia = await this.servicioArchivo.getFilePreview(archivo);
      this.archivosSeleccionados[tipo] = archivo;

      switch (tipo) {
        case 'perfil':
          this.fotoSeleccionada = vistaPrevia;
          break;
        case 'encargado':
          this.fotoEncargadoSeleccionada = vistaPrevia;
          break;
        case 'carta':
          this.cartaSeleccionada = vistaPrevia;
          this.esCartaPDF = archivo.type === 'application/pdf';
          break;
      }

    } catch (error) {
      console.error('Error procesando archivo:', error);
      this.servicioAlerta.alertaError('Error al procesar archivo');
      evento.target.value = '';
    }
  }

  /**
   * Elimina una foto o documento seleccionado
   */
  eliminarFoto(tipo: 'perfil' | 'encargado' | 'carta'): void {
    delete this.archivosSeleccionados[tipo];
    
    switch (tipo) {
      case 'perfil':
        this.fotoSeleccionada = null;
        break;
      case 'encargado':
        this.fotoEncargadoSeleccionada = null;
        break;
      case 'carta':
        this.cartaSeleccionada = null;
        this.esCartaPDF = false;
        break;
    }
  }

  // ==========================================
  // FUNCIONES DE UTILIDAD
  // ==========================================

  /**
   * Calcula la edad basada en la fecha de nacimiento
   */
  calcularEdad(fechaNacimiento: string): number {
    if (!fechaNacimiento) return 0;
    const hoy = new Date();
    const fechaNac = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - fechaNac.getFullYear();
    const diferenciaM = hoy.getMonth() - fechaNac.getMonth();
    if (diferenciaM < 0 || (diferenciaM === 0 && hoy.getDate() < fechaNac.getDate())) {
      edad--;
    }
    return edad;
  }

  /**
   * Llena el formulario con datos de un paciente existente
   */
  llenarFormulario(paciente: Paciente): void {
    this.formularioPaciente.patchValue({
      nombres: paciente.nombres,
      apellidos: paciente.apellidos,
      cui: paciente.cui,
      fechanacimiento: paciente.fechanacimiento ? 
        new Date(paciente.fechanacimiento).toISOString().split('T')[0] : '',
      genero: paciente.genero,
      tipoconsulta: paciente.tipoconsulta,
      tipodiscapacidad: paciente.tipodiscapacidad || 'Ninguna',
      telefonopersonal: paciente.telefonopersonal,
      nombrecontactoemergencia: paciente.nombrecontactoemergencia,
      telefonoemergencia: paciente.telefonoemergencia,
      nombreencargado: paciente.nombreencargado,
      dpiencargado: paciente.dpiencargado,
      telefonoencargado: paciente.telefonoencargado,
      municipio: paciente.municipio,
      aldea: paciente.aldea,
      direccion: paciente.direccion
    });
  }

  /**
   * Carga las fotos existentes de un paciente
   */
  cargarFotosExistentes(paciente: Paciente): void {
    if (paciente.rutafotoperfil) {
      this.fotoSeleccionada = this.servicioArchivo.getFileUrlFromPath(paciente.rutafotoperfil);
    }
    
    if (paciente.rutafotoencargado) {
      this.fotoEncargadoSeleccionada = this.servicioArchivo.getFileUrlFromPath(paciente.rutafotoencargado);
    }
    
    if (paciente.rutacartaautorizacion) {
      this.cartaSeleccionada = this.servicioArchivo.getFileUrlFromPath(paciente.rutacartaautorizacion);
      const extension = paciente.rutacartaautorizacion.toLowerCase().split('.').pop();
      this.esCartaPDF = extension === 'pdf';
    }
  }

  // ==========================================
  // VALIDACIONES DE FORMULARIO
  // ==========================================

  /**
   * Verifica si un campo específico es inválido
   */
  esCampoInvalido(nombreCampo: string): boolean {
    const campo = this.formularioPaciente.get(nombreCampo);
    return !!(campo && campo.invalid && (campo.dirty || campo.touched));
  }

  /**
   * Obtiene el mensaje de error para un campo específico
   */
  obtenerErrorCampo(nombreCampo: string): string {
    const campo = this.formularioPaciente.get(nombreCampo);
    
    if (campo && campo.errors) {
      if (campo.errors['required']) return 'Campo requerido';
      if (campo.errors['minlength']) return 'Muy corto';
      if (campo.errors['pattern']) {
        if (nombreCampo === 'cui') return 'CUI debe tener 13 dígitos';
        return 'Formato inválido';
      }
    }
    return '';
  }

  /**
   * Marca todos los campos del formulario como tocados
   */
  private marcarFormularioComoTocado(grupoFormulario: FormGroup): void {
    Object.keys(grupoFormulario.controls).forEach(clave => {
      const control = grupoFormulario.get(clave);
      control?.markAsTouched();
    });
  }



//  MÉTODOS DE PAGINACIÓN 

  /**
   * Actualiza la información de paginación
   */
  updatePagination(): void {
    this.totalItems = this.pacientesFiltrados.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    
    // Asegurar que currentPage esté en el rango válido
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = Math.max(1, this.totalPages);
    } else if (this.currentPage < 1) {
      this.currentPage = 1;
    }
    
    this.updatePaginatedPacientes();
  }

  /**
   * Actualiza los pacientes que se muestran en la página actual
   */
  updatePaginatedPacientes(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedPacientes = this.pacientesFiltrados.slice(startIndex, endIndex);
  }

  /**
   * Navega a una página específica
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedPacientes();
    }
  }

  /**
   * Navega a la página siguiente
   */
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedPacientes();
    }
  }

  /**
   * Navega a la página anterior
   */
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedPacientes();
    }
  }

  /**
   * Genera array de páginas para mostrar en la paginación
   */
  getPages(): number[] {
    if (this.totalPages <= 0) return [];
    
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    
    // Ajustar el inicio si hay menos páginas al final
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  /**
   * Maneja el cambio de elementos por página
   */
  onItemsPerPageChange(): void {
    // Asegurar que itemsPerPage sea un número
    this.itemsPerPage = Number(this.itemsPerPage);
    this.currentPage = 1; // Resetear a primera página
    this.updatePagination();
  }

  /**
   * Obtiene el rango de elementos mostrados
   */
  getDisplayRange(): string {
    if (this.totalItems === 0) return '0 - 0';
    const start = (this.currentPage - 1) * this.itemsPerPage + 1;
    const end = Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
    return `${start} - ${end}`;
  }

  /**
 * Navega al historial clínico de un paciente específico
 */
verHistorialClinico(paciente: Paciente): void {
  if (!paciente.idpaciente) {
    this.servicioAlerta.alertaPreventiva('No se puede acceder al historial: ID de paciente no válido');
    return;
  }


  
  // Verificar si el paciente tiene al menos un expediente
  const informacionExpediente = this.obtenerInformacionExpedientePaciente(paciente);
  
  if (!informacionExpediente.tieneExpediente) {
    Swal.fire({
      title: 'Expediente Requerido',
      html: `
        <p>El paciente <strong>${paciente.nombres} ${paciente.apellidos}</strong> no tiene un expediente médico asignado.</p>
        <p>¿Desea crear el expediente primero?</p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d',
      confirmButtonText: '<i class="fas fa-plus"></i> Crear Expediente',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then((resultado: any) => {
      if (resultado.isConfirmed) {
        this.crearExpedientePaciente(paciente);
      }
    });
    return;
  }

  // Guardar datos del paciente
  sessionStorage.setItem('datosPacienteHistorial', JSON.stringify(paciente));
  
  // Navegar al historial clínico - CAMBIÉ ESTA LÍNEA:
  this.router.navigate(['/historial', paciente.idpaciente]);
}

  
}