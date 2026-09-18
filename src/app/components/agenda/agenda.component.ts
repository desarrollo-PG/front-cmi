import { Component, OnInit, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SidebarComponent } from '../sidebar/sidebar.component';

// FullCalendar imports
import { FullCalendarModule } from '@fullcalendar/angular';
import { FullCalendarComponent } from '@fullcalendar/angular';
import { CalendarOptions, EventClickArg, DateSelectArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

// Date utilities
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArchivoService } from '../../services/archivo.service';
import { PerfilService } from '../../services/perfil.service';
import { UsuarioService, Usuario } from '../../services/usuario.service';
import { AlertaService } from '../../services/alerta.service';
import { Paciente, ServicioPaciente } from '../../services/paciente.service';
import { AgendaService, CitaRequest } from '../../services/agenda.service';
import { PdfExcelReporteriaService } from '../../services/pdf-excel-reporteria.service';
import { PermisoService } from '../../services/permiso.service';
import { NgSelectModule } from '@ng-select/ng-select';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

// Interfaces
export interface Cita {
  idagenda: number;
  fkusuario: number;
  fkpaciente: number;
  fechaatencion: string;
  horaatencion: string;
  comentario?: string;
  transporte?: number;
  fechatransporte?: string;
  horariotransporte?: string;
  direccion?: string;
  usuario: {
    nombres: string;
    apellidos: string;
    profesion?: string;
  };
  paciente: {
    nombres: string;
    apellidos: string;
    cui: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

@Component({
  selector: 'app-agenda',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    FullCalendarModule,
    SidebarComponent,
    NgSelectModule
  ],
  templateUrl: './agenda.component.html',
  styleUrls: ['./agenda.component.css']
})
export class AgendaComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('calendar') calendarComponent!: FullCalendarComponent;
  private perfilSubscription?: Subscription;
  
  // Configuración del calendario
  calendarOptions: CalendarOptions = {
    initialView: 'dayGridMonth',
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    headerToolbar: false,
    locale: 'es',
    firstDay: 1,
    
    height: 'auto',
    contentHeight: 'auto',
  
    
    expandRows: true,
    handleWindowResize: true,
    windowResizeDelay: 100,
    
    // Configuración de eventos
    events: [],
    selectable: true,
    selectMirror: true,
    dayMaxEvents: 0,        // Colapsa TODOS los eventos en badge numérico
    longPressDelay: 0,
    selectLongPressDelay: 0,
    eventLongPressDelay: 0,

    // Badge de conteo — muestra el número de citas del día
    moreLinkContent: (args: any) => ({
      html: `<span class="badge-citas-dia">
        <i class="fas fa-calendar-check badge-icon"></i>
        <span class="badge-num">${args.num}</span>
        <span class="badge-label"> cita${args.num !== 1 ? 's' : ''}</span>
      </span>`
    }),

    // Al hacer click en el badge → abrir panel del día (prevenimos el popover nativo)
    moreLinkClick: (info: any) => {
      info.jsEvent?.preventDefault();
      info.jsEvent?.stopPropagation();
      this.handleDayBadgeClick(info);
      // No retornar nada (void) — el CSS oculta el popover nativo como capa extra
    },

    selectAllow: (selectInfo) => {
      const fechaSeleccionada = selectInfo.startStr.split('T')[0];
      const hoy = format(new Date(), 'yyyy-MM-dd');
      return fechaSeleccionada >= hoy;
    },

    // Callbacks
    select: this.handleDateSelect.bind(this),
    dateClick: this.handleDateClick.bind(this),
    eventClick: this.handleEventClick.bind(this),
    eventsSet: this.handleEvents.bind(this),
    datesSet: this.handleDatesSet.bind(this),
    
    // Personalización
    titleFormat: { year: 'numeric', month: 'long' },
    buttonText: {
      today: 'Hoy',
      month: 'Mes',
      week: 'Semana',
      day: 'Día'
    },
    
    // Configuración de días
    weekends: true,
    editable: false,
    weekNumbers: false,
    
    // Configuración de slots de tiempo
    slotMinTime: '08:00:00',
    slotMaxTime: '18:00:00',
    slotDuration: '01:00:00',
    
    // Forzar que muestre todas las semanas del mes
    fixedWeekCount: false,
    showNonCurrentDates: true
  };

  // Variables de estado
  currentEvents: any[] = [];
  showModal = false;
  modalMode: 'create' | 'edit' | 'view' = 'create';
  selectedDate: string = '';
  selectedCita: CitaRequest | null = null;

  // Panel de citas del día
  mostrarPanelDia = false;
  fechaDiaSeleccionado = '';
  citasDiaSeleccionado: CitaRequest[] = [];
  selectedMedico: string = '';
  isSelectDisabled: boolean = false;
  // Distingue el filtro auto-asignado al cargar la pagina (puede caer a "Todos"
  // si el medico no tiene citas) de una seleccion manual del usuario (esa nunca
  // se debe revertir, aunque el medico elegido no tenga citas en el mes visible).
  private filtroEsAutomatico: boolean = false;
  currentView: string = 'dayGridMonth';
  loading = false;
  estadoSeleccionado: 'confirmada' | 'no-presentara' | null = null;
  comentarioNoAsistencia: string = '';
  loadingEstado: boolean = false;
  searchTerm: string = '';
  fechaActual: string = '';
  tituloCalendario: string = '';
  sidebarExpanded: boolean = false;
  sidebarVisible = false;
  userInfo: any = {};
  usuario: Usuario[] = [];
  paciente: Paciente[] = [];
  private calendarApi: any = null;
  // Por NOMBRE, no por ID: el idrol de cada uno cambia entre entornos e incluso
  // entre momentos distintos del mismo entorno (ya se ha confirmado mas de una vez).
  private readonly ROLES_PROFESIONAL_NOMBRES: string[] = [
    'Fisioterapeuta', 'Medico General', 'Psicólogo', 'Odontólogo', 'Nutricionista', 'Psicopedagogo'
  ];

  showModalReporte = false;
  reporteTransportes: any[] = [];
  fechaReporte: string = '';
  loadingReporte = false;
  fechaMinima: string = '';

  slotsDisponibles: any[] = [
    { hora: '08:00:00' },
    { hora: '08:30:00' },
    { hora: '09:00:00' },
    { hora: '09:30:00' },
    { hora: '10:00:00' },
    { hora: '10:30:00' },
    { hora: '11:00:00' },
    { hora: '11:30:00' },
    { hora: '14:00:00' },
    { hora: '14:30:00' },
    { hora: '15:00:00' },
    { hora: '15:30:00' },
    { hora: '16:00:00' },
    { hora: '16:30:00' },
    { hora: '17:00:00' }
  ];

  citaForm!: FormGroup;
  private currentUserId: string = '1';

  mostrarRecurrencia: boolean = false;
  tipoRecurrencia: 'diaria' | 'semanal' | 'mensual' = 'semanal';
  intervaloRecurrencia: number = 1;
  diasSemana: { [key: number]: boolean } = {
    1: false, // Lunes
    2: false, // Martes
    3: false, // Miércoles
    4: false, // Jueves
    5: false, // Viernes
    6: false, // Sábado
    0: false  // Domingo
  };
  fechaFinRecurrencia: string = '';
  numeroOcurrencias: number | null = null;
  usarFechaFin: boolean = true; // true = fecha fin, false = número de ocurrencias

  detallesSerieRecurrente: any = null;
  mostrandoCitaRecurrente: boolean = false;
  loadingPacientes: boolean = false;
  loadingUsuarios: boolean = false;

  constructor(
    private archivoService: ArchivoService,
    private UsuarioService: UsuarioService,
    private PacienteService: ServicioPaciente,
    private alerta: AlertaService,
    private fb: FormBuilder,
    private agendaService: AgendaService,
    private pdfExcelService: PdfExcelReporteriaService,
    private router: Router,
    private perfilService: PerfilService,
    private permisoService: PermisoService
  ) {
    this.initForm();
    this.fechaActual = new Date().toLocaleDateString('es-ES');
    this.tituloCalendario = format(new Date(), 'MMMM yyyy', { locale: es });
  }

  // Rutas de permiso del rol actual, para mostrar/ocultar elementos sin roles quemados en el código
  permisosAgenda: string[] = [];

  /** true si el rol actual tiene el permiso (o sub-permiso) identificado por esa ruta */
  puedeVer(rutaPermiso: string): boolean {
    return this.permisosAgenda.includes('*') || this.permisosAgenda.includes(rutaPermiso);
  }

  ngOnInit(): void {
    this.permisoService.obtenerMisRutas().subscribe({
      next: (rutas) => this.permisosAgenda = rutas || [],
      error: () => this.permisosAgenda = []
    });

    this.perfilSubscription = this.perfilService.perfil$.subscribe({
      next: (usuario) => {
        if (usuario) {
          this.userInfo = this.perfilService.obtenerInfoSidebar();
        }
      }
    });

    this.perfilService.obtenerPerfilDesdeBackend().subscribe();

    this.currentUserId = this.getCurrentUserId();
    this.configurarFiltroAutomatico();
    this.cargarCitas();
    this.loadUserInfo();
    this.cargarUsuariosPorRol();
    this.ListarPacientes();
    this.fechaMinima = format(new Date(), 'yyyy-MM-dd');
  }

  private configurarFiltroAutomatico(): void {
    try {
      const usuarioData = localStorage.getItem('usuario');
      if (usuarioData) {
        const usuario = JSON.parse(usuarioData);
        // Por nombre de rol, no por ID (idrol cambia entre entornos y momentos)
        const esAdministrador = usuario.rol?.nombre === 'Administrador' || usuario.rol?.nombre === 'Sistemas';

        if (!esAdministrador && usuario.idusuario) {
          this.selectedMedico = usuario.idusuario.toString();
          this.isSelectDisabled = true;
          this.filtroEsAutomatico = true;
        } else {
          this.selectedMedico = '';
          this.isSelectDisabled = false;
          this.filtroEsAutomatico = false;
        }
      }
    } catch (error) {
      this.selectedMedico = '';
      this.isSelectDisabled = false;
      this.filtroEsAutomatico = false;
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.detectSidebarState();
      
      // Forzar render inicial del calendario
      if (this.calendarComponent) {
        const api = this.calendarComponent.getApi();
        api.render();
        api.updateSize();
      }
    }, 100);
  }

  ngOnDestroy(): void {
    this.perfilSubscription?.unsubscribe();
  }

  verHistorialClinico(paciente: any): void {
    // Buscar el paciente completo en el array local para obtener expedientes
    const pacienteCompleto = this.paciente.find(p => p.idpaciente === (paciente.idpaciente || paciente.fkpaciente));
    if (pacienteCompleto && pacienteCompleto.idpaciente) {
      // Si tiene expedientes, pasar el número de expediente como query param
      const expediente = pacienteCompleto.expedientes && pacienteCompleto.expedientes.length > 0
        ? pacienteCompleto.expedientes[0].numeroexpediente
        : null;
      this.router.navigate([
        '/historial',
        pacienteCompleto.idpaciente
      ], {
        queryParams: expediente ? { numeroexpediente: expediente } : {}
      });
    } else if (paciente.idpaciente) {
      // Fallback si no está en el array local
      this.router.navigate(['/historial', paciente.idpaciente]);
    }
  }

  loadUserInfo(): void {
    try {
      const usuarioData = localStorage.getItem('usuario');
      
      if (usuarioData) {
        const usuario = JSON.parse(usuarioData);        
        
        this.userInfo = {
          name: `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim(),
          avatar: usuario.rutafotoperfil ? this.archivoService.obtenerUrlPublica(usuario.rutafotoperfil) : null
        };
      } 
    } catch (error) {
      console.error('Error al cargar información del usuario:', error);
    }
  }

  private getCurrentUserId(): string {
    try {
      const usuarioData = localStorage.getItem('usuario');
      if (usuarioData) {
        const usuario = JSON.parse(usuarioData);
        
        const userId = usuario.idusuario;
        if (userId) {
          return userId.toString();
        }
      }
    } catch (error) {
    }
    
    return '1';
  }

  private getCalendarApi(): any {
    if (this.calendarComponent) {
      return this.calendarComponent.getApi();
    }
    return null;
  }

  cargarUsuariosPorRol(): void {
    const usuarioData = localStorage.getItem('usuario');

    if (!usuarioData) {
      return;
    }

    const usuario = JSON.parse(usuarioData);
    const usuarioRolNombre = usuario.rol?.nombre;

    this.loadingUsuarios = true;

    if(this.ROLES_PROFESIONAL_NOMBRES.includes(usuarioRolNombre)){
      const currentUserId = this.getCurrentUserId();
      this.selectedMedico = currentUserId;

      this.citaForm.patchValue({
        fkusuario: parseInt(currentUserId)
      });

      // this.citaForm.get('fkusuario')?.disable();
      // this.isSelectDisabled = true;

      this.UsuarioService.obtenerProfesionalesAgenda().subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.usuario = response.data.map(usr => ({
              ...usr,
              nombreCompleto: `Dr. ${usr.nombres} ${usr.apellidos}`.trim()
            }));
            
            const usuarioActualEnLista = this.usuario.find(u => u.idusuario == parseInt(currentUserId));
            
            if (!usuarioActualEnLista) {
              this.UsuarioService.obtenerUsuarioPorId(parseInt(currentUserId)).subscribe({
                next: (responseUsuario) => {
                  if (responseUsuario.success && responseUsuario.data) {
                    const usuarioConNombre = {
                      ...responseUsuario.data,
                      nombreCompleto: `Dr. ${responseUsuario.data.nombres} ${responseUsuario.data.apellidos}`.trim()
                    };
                    this.usuario = [usuarioConNombre, ...this.usuario];
                    this.filtrarPorMedico();
                    this.loadingUsuarios = false;
                    
                    //Asegurar que siga seleccionado después de cargar
                    this.citaForm.patchValue({
                      fkusuario: parseInt(currentUserId)
                    });
                  }
                },
                error: (error) => {
                  console.error('Error al cargar usuario actual:', error);
                  if(error.status !== 403){
                    this.alerta.alertaError('Error al cargar el usuario actual');
                  }
                  this.loadingUsuarios = false;
                }
              });
            } else {
              this.filtrarPorMedico();
              this.loadingUsuarios = false;
            }
          } else {
            this.usuario = [];
            this.alerta.alertaInfo(response.message || 'No se encontraron usuarios');
            this.loadingUsuarios = false;
          }
        },
        error: (error) => {
          console.error('Error al obtener usuarios por rol:', error);
          if (error.status === 403) {
            this.alerta.alertaError('Error al cargar los usuarios por roles');
          }
          this.loadingUsuarios = false;
        }
      });
    } else {
      // Solo el administrador real desbloquea el selector; el resto (personal de
      // apoyo que no es profesional clinico ni admin) se queda con el bloqueo que
      // ya aplico configurarFiltroAutomatico(), y cargarCitas() lo hara caer a
      // "Todos los profesionales" en cuanto vea que no tiene citas propias.
      const esAdministrador = usuario.rol?.nombre === 'Administrador' || usuario.rol?.nombre === 'Sistemas';

      if (esAdministrador) {
        this.isSelectDisabled = false;
        this.citaForm.get('fkusuario')?.enable();
      }

      this.UsuarioService.obtenerProfesionalesAgenda().subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.usuario = response.data.map(usr => ({
              ...usr,
              nombreCompleto: `Dr. ${usr.nombres} ${usr.apellidos}`.trim()
            }));
          } else {
            this.usuario = [];
            this.alerta.alertaInfo(response.message || 'No se encontraron usuarios');
          }
          this.loadingUsuarios = false;
        },
        error: (error) => {
          console.error('Error al obtener usuarios por rol (admin):', error);
          if (error.status === 403) {
            this.alerta.alertaError('Error al cargar los usuarios por roles');
          }
          this.loadingUsuarios = false;
        }
      });
    }
  }

  ListarPacientes(): void {
    this.loadingPacientes = true;
    this.PacienteService.obtenerListadoPacientes().subscribe({
      next: (listadoUsuario) => { 
        this.paciente = listadoUsuario.map((pac: Paciente) => ({
          ...pac,
          nombreCompleto: `${pac.nombres} ${pac.apellidos} ${pac.cui || ''}`.trim(),
          cui: pac.cui
        }));
        
        this.loadingPacientes = false;
      },
      error: (error) => {
        console.error('Error al cargar pacientes:', error);
        this.loadingPacientes = false;
        if (error.status === 403) {
          return;
        }
        this.alerta.alertaError('Error al cargar pacientes');
      }
    });
  }

  onPacienteSeleccionado(event: any): void {
    const idPacienteSeleccionado = event.target.value;
    
    if (!idPacienteSeleccionado) {
      this.citaForm.patchValue({
        nombreEncargado: '',
        contactoEncargado: '',
        direccion: ''
      });
      return;
    }

    const pacienteSeleccionado = this.paciente.find(
      p => p.idpaciente == idPacienteSeleccionado
    );

    if (pacienteSeleccionado) {
      this.citaForm.patchValue({
        nombreEncargado: pacienteSeleccionado.nombreencargado || '',
        contactoEncargado: pacienteSeleccionado.telefonoencargado || '',
        direccion: pacienteSeleccionado.municipio + ', ' + pacienteSeleccionado.aldea + ', ' + pacienteSeleccionado.direccion || ''
      });
    }
  }

  onPacienteSeleccionadoNgSelect(pacienteSeleccionado: any): void {
    if (!pacienteSeleccionado) {
      this.citaForm.patchValue({
        nombreEncargado: '',
        contactoEncargado: '',
        direccion: ''
      });
      return;
    }

    this.citaForm.patchValue({
      nombreEncargado: pacienteSeleccionado.nombreencargado || '',
      contactoEncargado: pacienteSeleccionado.telefonoencargado || '',
      direccion: `${pacienteSeleccionado.municipio || ''}, ${pacienteSeleccionado.aldea || ''}, ${pacienteSeleccionado.direccion || ''}`.replace(/^,\s*|,\s*$/g, '').trim()
    });
  }

  toggleSidebarMobile(): void {
    this.sidebarVisible = !this.sidebarVisible;
  }

  onSidebarToggle(isExpanded: boolean): void {
    this.sidebarVisible = isExpanded;
  }

  detectSidebarState(): void {
    const checkSidebar = () => {
      const sidebar = document.querySelector('.sidebar-container') || 
                    document.querySelector('.sidebar') || 
                    document.querySelector('[class*="sidebar"]');
      
      if (sidebar) {
        const isExpanded = sidebar.classList.contains('expanded') || 
                          sidebar.classList.contains('open') ||
                          sidebar.classList.contains('sidebar-expanded');
        
        if (this.sidebarExpanded !== isExpanded) {
          this.sidebarExpanded = isExpanded;
          setTimeout(() => {
            this.resizeCalendar();
          }, 400);
        }
      }
    };

    setTimeout(checkSidebar, 100);
    
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          if (mutation.attributeName === 'class' || mutation.attributeName === 'style') {
            const target = mutation.target as Element;
            if (target.classList.contains('sidebar-container') || 
                target.classList.contains('sidebar') ||
                target.className.includes('sidebar')) {
              shouldCheck = true;
            }
          }
        }
      });
      
      if (shouldCheck) {
        checkSidebar();
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'style'],
      subtree: true
    });

    window.addEventListener('resize', () => {
      setTimeout(() => this.resizeCalendar(), 100);
    });
  }

  private resizeCalendar(): void {
    try {
      if (this.calendarComponent) {
        const api = this.calendarComponent.getApi();
        api.updateSize();
        
        api.render();
        return;
      }
      window.dispatchEvent(new Event('resize'));
    } catch (error) {
    }
  }

  public forceCalendarResize(): void {
    this.resizeCalendar();
  }

  initForm(): void {
    this.citaForm = this.fb.group({
      fkpaciente: ['', Validators.required],
      fkusuario: ['', Validators.required],
      fechaatencion: ['', Validators.required],
      horaatencion: ['', Validators.required],
      comentario: [''],
      transporte: [0],
      fechatransporte: [''],
      horariotransporte: [''],
      direccion: [''],
      nombreEncargado: [{value: '', disabled: true}],
      contactoEncargado: [{value: '', disabled: true}]
    });

    // Listener para sincronizar fecha de transporte cuando cambia fecha de atención
    this.citaForm.get('fechaatencion')?.valueChanges.subscribe(nuevaFecha => {
      if (nuevaFecha) {
        const transporteValue = this.citaForm.get('transporte')?.value;
        // Solo actualizar si el checkbox de transporte está marcado
        if (transporteValue) {
          this.citaForm.get('fechatransporte')?.setValue(nuevaFecha, { emitEvent: false });
        }
      }
    });

    // Listener para cuando se marque/desmarque el checkbox de transporte
    this.citaForm.get('transporte')?.valueChanges.subscribe(transporte => {
      if (transporte) {
        // Si se marca transporte y hay una fecha de atención, copiarla
        const fechaAtencion = this.citaForm.get('fechaatencion')?.value;
        if (fechaAtencion) {
          this.citaForm.get('fechatransporte')?.setValue(fechaAtencion, { emitEvent: false });
        }
      }
    });
  }

  configurarCitaRecurrente(): void {
    // Primero cambiar el estado
    this.mostrarRecurrencia = !this.mostrarRecurrencia;
    
    // Si se desmarca, resetear los valores
    if (!this.mostrarRecurrencia) {
      this.tipoRecurrencia = 'semanal';
      this.intervaloRecurrencia = 1;
      this.diasSemana = {
        1: false, 2: false, 3: false, 4: false,
        5: false, 6: false, 0: false
      };
      this.fechaFinRecurrencia = '';
      this.numeroOcurrencias = null;
      this.usarFechaFin = true;
    } else {
      // Al activar recurrencia, establecer fecha fin por defecto (3 meses)
      const fechaInicio = new Date(this.citaForm.get('fechaatencion')?.value || new Date());
      const fechaFin = new Date(fechaInicio);
      fechaFin.setMonth(fechaFin.getMonth() + 3);
      this.fechaFinRecurrencia = format(fechaFin, 'yyyy-MM-dd');
    }
  }

  obtenerDiasSeleccionados(): string {
    const nombresCompletos: { [key: number]: string } = {
      1: 'Lunes',
      2: 'Martes',
      3: 'Miércoles',
      4: 'Jueves',
      5: 'Viernes',
      6: 'Sábado',
      0: 'Domingo'
    };
    
    const diasSeleccionados = Object.entries(this.diasSemana)
      .filter(([_, selected]) => selected)
      .map(([dia, _]) => nombresCompletos[parseInt(dia)])
      .filter(nombre => nombre); // Filtrar undefined
    
    return diasSeleccionados.join(', ') || 'Ninguno seleccionado';
  }

  obtenerDiasSeleccionadosNumeros(): string {
    const dias = Object.entries(this.diasSemana)
      .filter(([_, selected]) => selected)
      .map(([dia, _]) => dia);
    return dias.join(',');
  }

  async cargarCitas(): Promise<void> {
    this.loading = true;
    try {
      this.agendaService.obtenerCitas().subscribe({
        next: (citas: CitaRequest[]) => {
          // Si el filtro automático (médico sin citas propias) no encuentra nada, mostrar
          // todos. Solo aplica mientras el filtro sigue siendo el asignado automáticamente
          // al cargar la página — una selección manual del usuario nunca se revierte,
          // aunque el médico elegido no tenga citas en el mes visible.
          if (this.filtroEsAutomatico && this.selectedMedico && this.isSelectDisabled) {
            const tieneCitasPropias = citas.some((c: CitaRequest) => c.fkusuario.toString() === this.selectedMedico);
            if (!tieneCitasPropias) {
              this.selectedMedico = '';
            }
            this.filtroEsAutomatico = false;
          }

          // Filtrar por médico si está seleccionado
          const citasFiltradas = this.selectedMedico
            ? citas.filter((c: CitaRequest) => c.fkusuario.toString() === this.selectedMedico)
            : citas;
          
          // Transformar las citas al formato de FullCalendar
          this.calendarOptions.events = citasFiltradas.map((cita: CitaRequest) => {
            const colorBase = this.getColorPorMedico(cita.fkusuario);
            const { backgroundColor, borderColor, textColor } = this.getEstilosPorEstado(cita.estado, colorBase);

            // Extraer solo YYYY-MM-DD y HH:MM:SS para evitar que FullCalendar
            // aplique conversión de timezone al recibir un ISO string con 'Z'
            const fechaSolo = String(cita.fechaatencion).substring(0, 10);
            const horaSolo  = String(cita.horaatencion).substring(0, 8);

            return {
              id: cita.idagenda?.toString() || '',
              title: `${cita.paciente?.nombres} ${cita.paciente?.apellidos}`,
              start: `${fechaSolo}T${horaSolo}`,
              backgroundColor,
              borderColor,
              textColor,
              extendedProps: {
                medico: `Dr. ${cita.usuario?.nombres} ${cita.usuario?.apellidos}`,
                paciente: `${cita.paciente?.nombres} ${cita.paciente?.apellidos}`,
                comentario: cita.comentario,
                horaatencion: cita.horaatencion,
                citaCompleta: cita
              }
            };
          });
          
          // Forzar actualización del calendario
          this.calendarOptions = { ...this.calendarOptions };
          
          //  Forzar re-render después de un delay
          setTimeout(() => {
            this.resizeCalendar();
            
            // Forzar render adicional
            if (this.calendarComponent) {
              const api = this.calendarComponent.getApi();
              api.render();
            }
          }, 100);
          
          this.loading = false;
        },
        error: (error) => {
          console.error('Error al cargar las citas:', error);
          this.loading = false;
          if (error.status === 403) {
            return;
          }
          this.alerta.alertaError('Error al cargar las citas');
        }
      });
    } catch (error) {
      this.alerta.alertaError('Error al cargar las citas');
      this.loading = false;
    }
  }

  // ── Panel de citas por día ──────────────────────────────
  handleDayBadgeClick(info: any): void {
    // Obtener todas las citas del día desde los segmentos
    const citas: CitaRequest[] = (info.allSegs || [])
      .map((seg: any) => seg.event?.extendedProps?.citaCompleta)
      .filter(Boolean)
      .sort((a: CitaRequest, b: CitaRequest) =>
        (a.horaatencion || '').localeCompare(b.horaatencion || '')
      );

    this.citasDiaSeleccionado = citas;

    // info.date viene como medianoche UTC desde FullCalendar.
    // Si se formatea directamente, date-fns lo convierte a hora local (UTC-6),
    // mostrando el día anterior. Se extrae la fecha en UTC y se construye
    // un Date local al mediodía para evitar el desfase de zona horaria.
    const utcDateStr = info.date.toISOString().split('T')[0]; // "YYYY-MM-DD" en UTC
    const localNoon = new Date(`${utcDateStr}T12:00:00`);
    this.fechaDiaSeleccionado = format(localNoon, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
    this.mostrarPanelDia = true;
  }

  cerrarPanelDia(): void {
    this.mostrarPanelDia = false;
    this.citasDiaSeleccionado = [];
    this.fechaDiaSeleccionado = '';
  }

  abrirCitaDesdePanel(cita: CitaRequest): void {
    this.cerrarPanelDia();
    this.modalMode = 'view';
    this.selectedCita = cita;
    this.showModal = true;
  }
  // ────────────────────────────────────────────────────────

  handleDateClick(info: any): void {
    const fechaSeleccionada = info.dateStr;
    const hoy = format(new Date(), 'yyyy-MM-dd');
    if (fechaSeleccionada < hoy) return;

    // En móvil el select no siempre dispara, así que dateClick abre el modal directamente
    if (window.innerWidth <= 768) {
      this.selectedDate = fechaSeleccionada;
      this.modalMode = 'create';
      this.selectedCita = null;
      this.citaForm.reset();
      this.citaForm.patchValue({ fechaatencion: fechaSeleccionada });
      this.showModal = true;
    }
  }

  handleDateSelect(selectInfo: DateSelectArg): void {
    const fechaSeleccionada = selectInfo.startStr.split('T')[0];
    const hoy = format(new Date(), 'yyyy-MM-dd');

    if (fechaSeleccionada < hoy) {
      this.alerta.alertaError('No se pueden crear citas en fechas pasadas');
      const calendarApi = selectInfo.view.calendar;
      calendarApi.unselect();
      return;
    }

    this.selectedDate = fechaSeleccionada;
    this.modalMode = 'create';
    this.selectedCita = null;

    // Obtener el usuario actual
    const usuarioData = localStorage.getItem('usuario');
    const usuario = usuarioData ? JSON.parse(usuarioData) : null;
    const usuarioRolNombre = usuario?.rol?.nombre;

    // Resetear formulario con o sin usuario pre-seleccionado
    this.citaForm.reset({
      fkpaciente: null,
      fkusuario: null,
      fechaatencion: fechaSeleccionada,
      horaatencion: '',
      comentario: '',
      transporte: 0,
      fechatransporte: fechaSeleccionada,
      horariotransporte: '',
      direccion: '',
      nombreEncargado: '',
      contactoEncargado: ''
    });

    this.showModal = true;

    // Preseleccionar profesional. Se difiere con setTimeout para que el ng-select
    // del modal ya exista en el DOM y haya procesado [items] antes de asignarle
    // un valor (si no, puede quedar visualmente en blanco aunque el FormControl
    // si tenga el valor correcto).
    if (this.ROLES_PROFESIONAL_NOMBRES.includes(usuarioRolNombre)) {
      const currentUserId = parseInt(this.getCurrentUserId());
      setTimeout(() => {
        if (this.usuario.some(u => u.idusuario === currentUserId)) {
          this.citaForm.get('fkusuario')?.setValue(currentUserId);
        } else {
          const interval = setInterval(() => {
            if (this.usuario.some(u => u.idusuario === currentUserId)) {
              this.citaForm.get('fkusuario')?.setValue(currentUserId);
              clearInterval(interval);
            }
          }, 100);
        }
      });
    }

    const calendarApi = selectInfo.view.calendar;
    calendarApi.unselect();
  }

  handleEventClick(clickInfo: EventClickArg): void {
    this.modalMode = 'view';
    this.selectedCita = clickInfo.event.extendedProps['citaCompleta'];
    
    // Verificar si es cita recurrente y cargar detalles
    if (this.selectedCita?.es_recurrente && this.selectedCita?.fkagenda_recurrente) {
      this.cargarDetallesSerieRecurrente(this.selectedCita.fkagenda_recurrente);
    } else {
      this.detallesSerieRecurrente = null;
      this.mostrandoCitaRecurrente = false;
    }
    
    this.showModal = true;
    this.estadoSeleccionado = null;
    this.comentarioNoAsistencia = '';
  }

  handleEvents(events: any[]): void {
    this.currentEvents = events;
  }

  handleDatesSet(dateInfo: any): void {
    // Obtener la fecha actual de la vista del calendario
    const api = this.getCalendarApi();
    if (api) {
      const currentDate = api.getDate(); 
      this.tituloCalendario = format(currentDate, 'MMMM yyyy', { locale: es });
    }
    
    setTimeout(() => this.resizeCalendar(), 100);
  }

  getColorPorMedico(medicoId: number): string {
    const colores = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    return colores[medicoId % colores.length];
  }

  getEstilosPorEstado(estado: number | null | undefined, colorMedico: string): { backgroundColor: string, borderColor: string, textColor: string } {
    switch (estado) {
      case 2: // Confirmada
        return {
          backgroundColor: '#1a8a5c',
          borderColor: '#146b47',
          textColor: '#ffffff'
        };
      case 3: // No se presentó
        return {
          backgroundColor: '#95a5a6',
          borderColor: '#7f8c8d',
          textColor: '#ffffff'
        };
      default: // Pendiente
        return { 
          backgroundColor: colorMedico,
          borderColor: colorMedico,
          textColor: '#ffffff'
        };
    }
  }

  cargarDetallesSerieRecurrente(idagendaRecurrente: number): void {
    this.agendaService.obtenerDetallesSerieRecurrente(idagendaRecurrente).subscribe({
      next: (response) => {
        if (response.success) {
          this.detallesSerieRecurrente = response.data;
          this.mostrandoCitaRecurrente = true;
        }
      },
      error: () => {
        this.mostrandoCitaRecurrente = false;
      }
    });
  }

  abrirModalNuevaCita(): void {
    const fechaHoy = this.fechaMinima;
    
    this.selectedDate = fechaHoy;
    this.modalMode = 'create';
    this.selectedCita = null;

    // Limpiar ng-select de paciente manualmente
    this.citaForm.get('fkpaciente')?.setValue(null);

    const usuarioData = localStorage.getItem('usuario');
    const usuario = usuarioData ? JSON.parse(usuarioData) : null;
    const usuarioRolNombre = usuario?.rol?.nombre;

    this.citaForm.reset({
      fkpaciente: null,        // null en lugar de '' para ng-select
      fkusuario: null,
      fechaatencion: fechaHoy,
      horaatencion: '',
      comentario: '',
      transporte: 0,
      fechatransporte: fechaHoy,
      horariotransporte: '',
      direccion: '',
      nombreEncargado: '',
      contactoEncargado: ''
    });

    this.showModal = true;

    // Preseleccionar profesional si el rol corresponde. Se difiere con setTimeout
    // para que el ng-select del modal ya exista en el DOM y haya procesado [items]
    // antes de asignarle un valor (si no, puede quedar visualmente en blanco aunque
    // el FormControl si tenga el valor correcto).
    if (this.ROLES_PROFESIONAL_NOMBRES.includes(usuarioRolNombre)) {
      const currentUserId = parseInt(this.getCurrentUserId());

      setTimeout(() => {
        if (this.usuario.some(u => u.idusuario === currentUserId)) {
          this.citaForm.get('fkusuario')?.setValue(currentUserId);
        } else {
          // Esperar a que cargue la lista (o el fallback que agrega al usuario actual)
          const interval = setInterval(() => {
            if (this.usuario.some(u => u.idusuario === currentUserId)) {
              this.citaForm.get('fkusuario')?.setValue(currentUserId);
              clearInterval(interval);
            }
          }, 100);
        }
      });
    }
  }

  cerrarModal(): void {
    this.showModal = false;
    this.selectedCita = null;
    this.mostrarRecurrencia = false;
    this.mostrandoCitaRecurrente = false;
    this.detallesSerieRecurrente = null;
    this.tipoRecurrencia = 'semanal';
    this.intervaloRecurrencia = 1;
    this.diasSemana = {
      1: false, 2: false, 3: false, 4: false,
      5: false, 6: false, 0: false
    };
    this.fechaFinRecurrencia = '';
    this.numeroOcurrencias = null;
    this.usarFechaFin = true;
    this.estadoSeleccionado = null;
    this.comentarioNoAsistencia = '';
    this.loadingEstado = false;
    
    this.citaForm.reset({
      fkpaciente: '',
      fkusuario: '',
      fechaatencion: '',
      horaatencion: '',
      comentario: '',
      transporte: 0,
      fechatransporte: '',
      horariotransporte: '',
      direccion: '',
      nombreEncargado: '',
      contactoEncargado: ''
    });
  }

  editarCita(): void {
    if (this.selectedCita) {
      this.modalMode = 'edit';
      
      // Si es cita recurrente, mostrar advertencia
      if (this.selectedCita.es_recurrente) {
        this.mostrandoCitaRecurrente = true;
      }
      
      // Cargar los datos de la cita en el formulario
      this.citaForm.patchValue({
        fkpaciente: this.selectedCita.fkpaciente,
        fkusuario: this.selectedCita.fkusuario,
        fechaatencion: this.selectedCita.fechaatencion,
        horaatencion: this.selectedCita.horaatencion,
        comentario: this.selectedCita.comentario || '',
        transporte: this.selectedCita.transporte || 0,
        fechatransporte: this.selectedCita.fechatransporte || '',
        horariotransporte: this.selectedCita.horariotransporte || '',
        direccion: this.selectedCita.direccion || ''
      });

      // Si hay paciente seleccionado, cargar sus datos
      if (this.selectedCita.fkpaciente) {
        const pacienteSeleccionado = this.paciente.find(
          p => p.idpaciente === this.selectedCita!.fkpaciente
        );

        if (pacienteSeleccionado) {
          this.citaForm.patchValue({
            nombreEncargado: pacienteSeleccionado.nombreencargado || '',
            contactoEncargado: pacienteSeleccionado.telefonoencargado || '',
            direccion: pacienteSeleccionado.municipio + ', ' + pacienteSeleccionado.aldea + ', ' + pacienteSeleccionado.direccion || '',
          });
        }
      }
    }
  }

  guardarCita(): void {
    if (this.citaForm.invalid) {
      this.alerta.alertaError('Por favor complete todos los campos requeridos');
      return;
    }

    const fechaCita = this.citaForm.get('fechaatencion')?.value;
    const hoy = format(new Date(), 'yyyy-MM-dd');
    
    if (fechaCita < hoy) {
      this.alerta.alertaError('No se pueden crear citas en fechas pasadas');
      return;
    }

    // Si es recurrente y es semanal, validar que hay días seleccionados
    if (this.mostrarRecurrencia && this.tipoRecurrencia === 'semanal') {
      const diasSeleccionados = this.obtenerDiasSeleccionados();
      if (!diasSeleccionados) {
        this.alerta.alertaError('Debe seleccionar al menos un día de la semana');
        return;
      }
    }

    // Validar que haya fecha fin o número de ocurrencias
    if (this.mostrarRecurrencia) {
      if (this.usarFechaFin && !this.fechaFinRecurrencia) {
        this.alerta.alertaError('Debe especificar una fecha de fin');
        return;
      }
      if (!this.usarFechaFin && (!this.numeroOcurrencias || this.numeroOcurrencias < 1)) {
        this.alerta.alertaError('Debe especificar el número de ocurrencias');
        return;
      }
    }

    this.loading = true;
    const currentUserId = this.getCurrentUserId();

    const fkusuario = this.citaForm.get('fkusuario')?.value || 
                    this.citaForm.getRawValue().fkusuario;
    const horaSeleccionada = this.citaForm.get('horaatencion')?.value;
    const horaFormateada = horaSeleccionada.includes(':00:00') 
      ? horaSeleccionada 
      : horaSeleccionada.length === 5 
        ? `${horaSeleccionada}:00` 
        : horaSeleccionada;

    const transporteValue = this.citaForm.get('transporte')?.value;
    const transporteNumero = transporteValue ? 1 : 0;

    if (transporteNumero === 1) {
      const fechaTransporte = this.citaForm.get('fechatransporte')?.value;
      const horarioTransporte = this.citaForm.get('horariotransporte')?.value;
      const direccion = this.citaForm.get('direccion')?.value;

      if (!fechaTransporte || !horarioTransporte || !direccion || direccion.trim() === '') {
        this.alerta.alertaError('Cuando se solicita transporte, debe completar la fecha, hora y dirección del transporte');
        this.loading = false;
        return;
      }
    }

    // Si es cita recurrente
    if (this.mostrarRecurrencia && this.modalMode === 'create') {
      const datosRecurrentes: any = {
        //fkusuario: parseInt(this.citaForm.get('fkusuario')?.value),
        fkusuario: parseInt(fkusuario),
        fkpaciente: parseInt(this.citaForm.get('fkpaciente')?.value),
        horaatencion: horaFormateada,
        comentario: this.citaForm.get('comentario')?.value || '',
        transporte: transporteNumero,
        fechatransporte: transporteNumero ? this.citaForm.get('fechatransporte')?.value : null,
        horariotransporte: transporteNumero ? this.citaForm.get('horariotransporte')?.value : null,
        direccion: transporteNumero ? this.citaForm.get('direccion')?.value : '',
        tipo_recurrencia: this.tipoRecurrencia,
        intervalo: this.intervaloRecurrencia,
        fecha_inicio: this.citaForm.get('fechaatencion')?.value,
        usuariocreacion: currentUserId
      };

      // Agrega días de semana si es recurrencia semanal
      if (this.tipoRecurrencia === 'semanal') {
        datosRecurrentes.dias_semana = this.obtenerDiasSeleccionadosNumeros();
      }

      // Agrega fecha fin o número de ocurrencias
      if (this.usarFechaFin) {
        datosRecurrentes.fecha_fin = this.fechaFinRecurrencia;
      } else {
        datosRecurrentes.numero_ocurrencias = this.numeroOcurrencias;
      }

      this.agendaService.crearCitaRecurrente(datosRecurrentes).subscribe({
        next: (response) => {
          this.loading = false;
          if (response.success) {
            this.alerta.alertaExito(response.message || 'Citas recurrentes creadas exitosamente');
            this.cargarCitas();
            this.cerrarModal();
          } else {
            if (response.conflictos && response.conflictos.length > 0) {
              const conflictosMsg = response.conflictos
                .map(c => `${c.fecha}: ${c.mensaje}`)
                .join('\n');
              this.alerta.alertaError(`Para alguna fecha seleccionada ya tiene cita agendada`);
            } else {
              this.alerta.alertaInfo(response.message || 'No se pudieron crear las citas');
            }
          }
        },
        error: (error) => {
          console.error('Error al crear citas recurrentes:', error);
          this.loading = false;
          if (error.status === 403) {
            return;
          }
          this.alerta.alertaError('Error al crear citas recurrentes. Intenta nuevamente.');
        }
      });
      return;
    }

    // Código existente para citas normales
    const datosCita: CitaRequest = {
      //fkusuario: parseInt(this.citaForm.get('fkusuario')?.value),
      fkusuario: parseInt(fkusuario),
      fkpaciente: parseInt(this.citaForm.get('fkpaciente')?.value),
      fechaatencion: this.citaForm.get('fechaatencion')?.value,
      horaatencion: horaFormateada,
      comentario: this.citaForm.get('comentario')?.value || '',
      transporte: transporteNumero,
      fechatransporte: transporteNumero ? this.citaForm.get('fechatransporte')?.value : null,
      horariotransporte: transporteNumero ? this.citaForm.get('horariotransporte')?.value : null,
      direccion: transporteNumero ? this.citaForm.get('direccion')?.value : '',
      usuariocreacion: currentUserId,
      usuariomodificacion: currentUserId,
      estado: 1
    };

    if (this.modalMode === 'create') {
      this.agendaService.crearCita(datosCita).subscribe({
        next: (response) => {
          this.loading = false;
          if (response.success) {
            this.alerta.alertaExito(response.message || 'Cita creada exitosamente');
            this.cargarCitas();
            this.cerrarModal();
          } else {
            this.alerta.alertaInfo(response.message || 'No se pudo crear la cita');
          }
        },
        error: (error) => {
          console.error('Error al crear cita:', error);
          this.loading = false;
          if (error.status === 403) {
            return;
          }
          this.alerta.alertaError('Error al crear cita. Intenta nuevamente.');
        }
      });
    } else if (this.modalMode === 'edit' && this.selectedCita) {
      if (!this.selectedCita.idagenda) {
        this.alerta.alertaError('Error: No se encontró el ID de la cita');
        this.loading = false;
        return;
      }

      this.agendaService.actualizarCita(this.selectedCita.idagenda, datosCita).subscribe({
        next: (response) => {
          this.loading = false;
          if (response.success) {
            this.alerta.alertaExito(response.message || 'Cita actualizada exitosamente');
            this.cargarCitas();
            this.cerrarModal();
          } else {
            this.alerta.alertaInfo(response.message || 'No se pudo actualizar la cita');
          }
        },
        error: (error) => {
          console.error('Error al actualizar cita:', error);
          this.loading = false;
          if (error.status === 403) {
            return;
          }
          this.alerta.alertaError('Error al actualizar cita. Intenta nuevamente.');
        }
      });
    }
  }

  async eliminarCita(): Promise<void> {
    if (!this.selectedCita || !this.selectedCita.idagenda) {
      this.alerta.alertaError('No se puede eliminar la cita');
      return;
    }
    
    if (this.selectedCita.es_recurrente && this.selectedCita.fkagenda_recurrente) {
      const opcion = await this.alerta.alertaConfirmacionConOpciones(
        '¿Qué deseas eliminar?',
        'Esta cita forma parte de una serie recurrente, Usa esta opción solo si la cita fue creada por error',
        'Solo esta cita',
        'Toda la serie'
      );
      
      if (opcion === null) {
        return; 
      }
      
      this.loading = true;
      const currentUserId = this.getCurrentUserId();
      
      if (opcion === 'serie') {
        this.agendaService.cancelarSerieCompleta(
          this.selectedCita.fkagenda_recurrente, 
          currentUserId
        ).subscribe({
          next: (response) => {
            if (response.success) {
              this.alerta.alertaExito(response.message || 'Serie eliminada exitosamente');
              this.cargarCitas();
              this.cerrarModal();
            } else {
              this.alerta.alertaError(response.message || 'Error al eliminar la serie');
            }
            this.loading = false;
          },
          error: (error) => {
            console.error('Error al eliminar la serie:', error);
            this.loading = false;
            if (error.status === 403) {
              return;
            }
            this.alerta.alertaError('Error al eliminar la serie');
          }
        });
      } else {
        this.agendaService.cancelarCitaRecurrente(
          this.selectedCita.idagenda, 
          currentUserId
        ).subscribe({
          next: (response) => {
            if (response.success) {
              this.alerta.alertaExito(response.message || 'Cita eliminada exitosamente');
              this.cargarCitas();
              this.cerrarModal();
            } else {
              this.alerta.alertaError(response.message || 'Error al eliminar la cita');
            }
            this.loading = false;
          },
          error: (error) => {
            console.error('Error al cancelar cita recurrente:', error);
            this.loading = false;
            if (error.status === 403) {
              return;
            }
            this.alerta.alertaError('Error al eliminar la cita');
          }
        });
      }
    } else {
      const confirmacion = await this.alerta.alertaConfirmacion(
        '¿Estás seguro de que deseas eliminar este registro?',
        'Usa esta opción solo si la cita fue creada por error',
        'Sí, Eliminar',
        'No, Cerrar'
      );
      
      if (!confirmacion) {
        return;
      }
      
      this.loading = true;
      const currentUserId = this.getCurrentUserId();
      
      this.agendaService.eliminarCita(this.selectedCita.idagenda, currentUserId).subscribe({
        next: (response) => {
          if (response.success) {
            this.alerta.alertaExito('Cita eliminada exitosamente');
            this.cargarCitas();
            this.cerrarModal();
          } else {
            this.alerta.alertaError(response.message || 'Error al eliminar la cita');
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error al eliminar cita directa:', error);
          this.loading = false;

          if (error.status === 403) {
            return;
          }
          this.alerta.alertaError('Error al eliminar la cita');
        }
      });
    }
  }

  formatearTipoRecurrencia(tipo: string): string {
    const tipos: { [key: string]: string } = {
      'diaria': 'Diaria',
      'semanal': 'Semanal',
      'mensual': 'Mensual'
    };
    return tipos[tipo] || tipo;
  }

  formatearDiasSemana(diasStr: string): string {
    if (!diasStr) return 'N/A';
    
    const nombresCompletos: { [key: string]: string } = {
      '1': 'Lunes',
      '2': 'Martes',
      '3': 'Miércoles',
      '4': 'Jueves',
      '5': 'Viernes',
      '6': 'Sábado',
      '0': 'Domingo'
    };
    
    return diasStr.split(',')
      .map(dia => nombresCompletos[dia.trim()])
      .filter(nombre => nombre)
      .join(', ');
  }

  cambiarVista(vista: string): void {
    this.currentView = vista;
    if (this.calendarComponent) {
      const api = this.calendarComponent.getApi();
      api.changeView(vista);
      setTimeout(() => this.resizeCalendar(), 100);
    }
  }

  navegarMes(direccion: 'prev' | 'next'): void {
    if (!this.calendarComponent) {
      return;
    }
    
    const api = this.calendarComponent.getApi();
    
    if (direccion === 'prev') {
      api.prev();
    } else {
      api.next();
    }
  }

  irAHoy(): void {
    if (this.calendarComponent) {
      const api = this.calendarComponent.getApi();
      api.today();
    }
  }

  async filtrarPorMedico(): Promise<void> {
    // El usuario tomo control manual del filtro: ya no se debe revertir a
    // "Todos los profesionales" aunque el medico elegido no tenga citas.
    this.filtroEsAutomatico = false;
    await this.cargarCitas();
  }

  buscarCitas(): void {
  }

  abrirModalReporte(): void {
    const fechaHoy = format(new Date(), 'yyyy-MM-dd');
    this.fechaReporte = fechaHoy;
    this.showModalReporte = true;
    
    // Cargar automáticamente el reporte del día actual
    this.generarReporte();
  }

  cerrarModalReporte(): void {
    this.showModalReporte = false;
    this.reporteTransportes = [];
    this.fechaReporte = '';
  }

  generarReporte(): void {
    if (!this.fechaReporte) {
      this.alerta.alertaError('Por favor seleccione una fecha');
      return;
    }
    
    this.loadingReporte = true;
    
    this.agendaService.obtenerCitasConTransporte(this.fechaReporte).subscribe({
      next: (response) => {
        if (response.success) {
          this.reporteTransportes = response.data;
          
          if (this.reporteTransportes.length === 0) {
            this.alerta.alertaInfo('No hay citas con transporte para la fecha seleccionada');
          }
        } else {
          this.alerta.alertaError('Error al generar el reporte');
        }
        this.loadingReporte = false;
      },
      error: (error) => {
        console.error('Error al generar reporte de transportes:', error);
        this.loadingReporte = false;
        if (error.status === 403) {
          return;
        }
        this.alerta.alertaError('Error al generar el reporte de transportes');
      }
    });
  }

  async exportarReportePDF(): Promise<void> {
    if (this.reporteTransportes.length === 0) {
      this.alerta.alertaError('No hay datos para exportar');
      return;
    }
    
    try {
      await this.pdfExcelService.generarPDF('transporte', this.reporteTransportes);
      this.alerta.alertaExito('PDF generado exitosamente');
    } catch (error) {
      this.alerta.alertaError('Error al generar el PDF');
    }
  }

  exportarReporteExcel(): void {
    if (this.reporteTransportes.length === 0) {
      this.alerta.alertaError('No hay datos para exportar');
      return;
    }
    
    try {
      this.pdfExcelService.generarExcel('transporte', this.reporteTransportes);
      this.alerta.alertaExito('Excel generado exitosamente');
    } catch (error) {
      this.alerta.alertaError('Error al generar el Excel');
    }
  }

  formatearHora(hora: any): string {
    if (!hora) return 'N/A';
    
    // Si es un string con formato completo de timestamp
    if (typeof hora === 'string') {
      // Si tiene microsegundos: "1970-01-01T08:30:00.000Z"
      if (hora.includes('T')) {
        return hora.split('T')[1].substring(0, 5); // Retorna HH:mm
      }
      // Si ya es formato de hora: "08:30:00"
      if (hora.includes(':')) {
        return hora.substring(0, 5); // Retorna HH:mm
      }
    }
    
    // Si es un objeto Date
    if (hora instanceof Date) {
      const horas = hora.getHours().toString().padStart(2, '0');
      const minutos = hora.getMinutes().toString().padStart(2, '0');
      return `${horas}:${minutos}`;
    }
    
    return hora.toString().substring(0, 5);
  }

  // Agregar este método para obtener el nombre del día
  obtenerNombreDia(dia: number): string {
    const nombres: { [key: number]: string } = {
      0: 'Domingo',
      1: 'Lunes',
      2: 'Martes',
      3: 'Miércoles',
      4: 'Jueves',
      5: 'Viernes',
      6: 'Sábado'
    };
    return nombres[dia] || '';
  }

  detectarScrollModal(): void {
    // Esperar a que el modal se renderice
    setTimeout(() => {
      const modalBody = document.querySelector('.modal-body');
      if (modalBody) {
        modalBody.addEventListener('scroll', (event) => {
          const target = event.target as HTMLElement;
          if (target.scrollTop > 10) {
            target.classList.add('scrolled');
          } else {
            target.classList.remove('scrolled');
          }
        });
      }
    }, 100);
  }

  seleccionarEstado(estado: 'confirmada' | 'no-presentara'): void {
    if (this.estadoSeleccionado === estado) {
      this.estadoSeleccionado = null;
      this.comentarioNoAsistencia = '';
    } else {
      this.estadoSeleccionado = estado;
      this.comentarioNoAsistencia = '';
    }
  }

  guardarEstadoCita(): void {
    if (!this.selectedCita?.idagenda) return;

    if (this.estadoSeleccionado === 'no-presentara' && !this.comentarioNoAsistencia.trim()) {
      this.alerta.alertaError('Debe ingresar un comentario para registrar la inasistencia');
      return;
    }

    const estadoNumero = this.estadoSeleccionado === 'confirmada' ? 2 : 3;
    const comentario = this.estadoSeleccionado === 'confirmada'
      ? 'Asistencia confirmada'
      : this.comentarioNoAsistencia.trim();

    this.loadingEstado = true;
    const currentUserId = this.getCurrentUserId();

    this.agendaService.actualizarEstadoCita(
      this.selectedCita.idagenda,
      estadoNumero,
      comentario,
      currentUserId
    ).subscribe({
      next: (response) => {
        this.loadingEstado = false;
        if (response.success) {
          this.selectedCita!.estado = estadoNumero;
          const msg = this.estadoSeleccionado === 'confirmada'
            ? 'Asistencia confirmada correctamente'
            : 'Inasistencia registrada correctamente';
          this.alerta.alertaExito(msg);
          this.cargarCitas();
        } else {
          this.alerta.alertaError(response.message || 'Error al actualizar el estado');
        }
      },
      error: (error) => {
        this.loadingEstado = false;
        if (error.status !== 403) {
          this.alerta.alertaError('Error al actualizar el estado de la cita');
        }
      }
    });
  }
}