import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms'; 
import { UsuarioService, Usuario, Rol } from '../../services/usuario.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { AlertaService } from '../../services/alerta.service';
import { FormatoTelefonicoDirective } from '../../directives/numeroFormato';
import { formatoInputDirective } from '../../directives/formatoInput';
import { ArchivoService } from '../../services/archivo.service';
import { AuthService } from '../../services/auth.service';

// Extender la interface User para incluir los nuevos campos
export interface ExtendedUser extends Usuario {
  employeeNumber?: string;
  collegiateNumber?: string;
  schedule?: string;
  status?: string;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, SidebarComponent, FormatoTelefonicoDirective, formatoInputDirective ],
  templateUrl: './usuario.component.html',
  styleUrls: ['./usuario.component.css']
})
export class UsuarioComponent implements OnInit, AfterViewInit {
  currentView: 'list' | 'form' | 'detail' = 'list';
  users: ExtendedUser[] = [];
  filteredUsers: ExtendedUser[] = [];
  paginatedUsers: ExtendedUser[] = [];
  selectedUser: ExtendedUser | null = null;
  userForm: FormGroup;
  isEditMode = false;
  isViewMode = false;
  loading = false;
  searchTerm = '';
  currentDate = new Date();
  sidebarExpanded = true;
  userInfo: any = {};
  roles: Rol[] = [];

  selectedPhoto: File | null = null;
  selectedDocument: File | null = null;
  photoPreview: string | null = null;
  documentInfo: { name: string, size: number } | null = null;

  // Variables de paginación
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;
  totalItems = 0;
  
  // Exponer Math para usar en el template
  Math = Math;

  constructor(
    private UsuarioService: UsuarioService,
    private fb: FormBuilder,
    private alerta: AlertaService,
    private archivoService: ArchivoService,
    private authService: AuthService
  ) {
    this.userForm = this.fb.group({
      nombres: ['', [Validators.required]],
      apellidos: ['', [Validators.required]],
      usuario: ['', [Validators.required]],
      password: ['', [Validators.required]],
      confirmPassword: ['', [Validators.required]],
      correo: ['', [Validators.required, Validators.email]],
      confirmCorreo: ['', [Validators.required, Validators.email]],
      puesto: ['', [Validators.required]],
      telinstitucional: ['+502 ', [Validators.required]],
      extension: [''],
      telPersonal: ['+502 ', [Validators.required]],
      contactoEmergencia: ['', [Validators.required]],
      telEmergencia: ['+502 ', [Validators.required]],
      profesion: ['', [Validators.required]],
      fechaNacimiento: [''],
      role: ['', [Validators.required]],
      observaciones: [''],
      status: ['', [Validators.required]]
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.userForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.userForm.get(fieldName);
    if (field && field.errors && (field.dirty || field.touched)) {
      
      if (field.errors['required']) {
        return `${this.getFieldDisplayName(fieldName)} es requerido`;
      }
      if (field.errors['email']) {
        return 'Ingrese un correo válido';
      }
      
      // Mensajes específicos por tipo de campo
      switch (fieldName) {
        case 'nombres':
        case 'apellidos':
        case 'profesion':
        case 'contactoEmergencia':
          return 'Solo se permiten letras y espacios';
        case 'extension':
          return 'Solo números, máximo 4 dígitos';
        default:
          return 'Campo inválido';
      }
    }
    return '';
  }

  private getFieldDisplayName(fieldName: string): string {
    const fieldNames: { [key: string]: string } = {
      'nombres': 'Nombres',
      'apellidos': 'Apellidos',
      'usuario': 'Usuario',
      'password': 'Contraseña',
      'confirmPassword': 'Confirmar contraseña',
      'correo': 'Correo institucional',
      'confirmCorreo': 'Confirmar correo',
      'puesto': 'Puesto laboral',
      'telinstitucional': 'Teléfono institucional',
      'extension': 'Extensión',
      'telPersonal': 'Teléfono personal',
      'contactoEmergencia': 'Contacto de emergencia',
      'telEmergencia': 'Teléfono de emergencia',
      'profesion': 'Profesión',
      'role': 'Rol',
      'status': 'Estado'
    };
    return fieldNames[fieldName] || fieldName;
  }

  async onPhotoSelected(event: any): Promise<void> {
    const file = event.target.files[0];
    if (file) {
      try {
        this.selectedPhoto = file;
        this.photoPreview = await this.archivoService.crearVistaPrevia(file);
      } catch (error: any) {
        this.alerta.alertaError(error.message);
      }
    }
  }

  /**
   * Maneja selección de documento - SÚPER SIMPLE
   */
  onDocumentSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        this.alerta.alertaError('Solo se permiten archivos PDF');
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        this.alerta.alertaError('El documento no puede superar los 10MB');
        return;
      }

      this.selectedDocument = file;
      this.documentInfo = {
        name: file.name,
        size: file.size
      };
    }
  }

  ngOnInit(): void {
    this.loadUserInfo();
    this.loadUsers();
    this.loadRoles();
  }

  ngAfterViewInit(): void {
    this.detectSidebarState();
  }

  detectSidebarState(): void {
    const checkSidebar = () => {
      const sidebar = document.querySelector('.sidebar-container');
      if (sidebar) {
        const wasExpanded = this.sidebarExpanded;
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

  loadUserInfo(): void {
    try {
      const usuarioData = localStorage.getItem('usuario');
      
      if (usuarioData) {
        const usuario = JSON.parse(usuarioData);        
        
        this.userInfo = {
          name: `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim(),
          avatar: usuario.rutafotoperfil ? this.archivoService.obtenerUrlPublica(usuario.rutafotoperfil) : null
          // role: usuario.fkrol || usuario.role || ''
        };
      } 
    } catch (error) {
      console.error('Error al cargar información del usuario:', error);
    }
  }

  loadRoles(): void {
    this.UsuarioService.obtenerRoles().subscribe({
      next: (roles) => {
        this.roles = roles; // Tu service ya maneja la extracción de .data
      },
      error: (error) => {
        console.error('Error loading roles:', error);
        this.alerta.alertaError('Error al cargar los roles');
      }
    });
  }

  // MÉTODOS DE PAGINACIÓN
  updatePagination(): void {
    this.totalItems = this.filteredUsers.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    
    // Asegurar que currentPage esté en el rango válido
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = Math.max(1, this.totalPages);
    } else if (this.currentPage < 1) {
      this.currentPage = 1;
    }
    
    this.updatePaginatedUsers();
  }

  updatePaginatedUsers(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedUsers = this.filteredUsers.slice(startIndex, endIndex);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedUsers();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedUsers();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedUsers();
    }
  }

  // Generar array de páginas para mostrar en la paginación
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

  // Método para cambiar items por página
  onItemsPerPageChange(): void {
    // Asegurar que itemsPerPage sea un número
    this.itemsPerPage = Number(this.itemsPerPage);
    this.currentPage = 1; // Resetear a primera página
    this.updatePagination();
  }

  // Método para obtener el rango de elementos mostrados
  getDisplayRange(): string {
    if (this.totalItems === 0) return '0 - 0';
    const start = (this.currentPage - 1) * this.itemsPerPage + 1;
    const end = Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
    return `${start} - ${end}`;
  }

  // NAVEGACIÓN ENTRE VISTAS
  showList(): void {
    this.currentView = 'list';
    this.selectedUser = null;
    this.isViewMode = false;
    this.resetForm();
    this.updatePasswordValidators();
  }

  showForm(): void {
    this.currentView = 'form';
    this.isEditMode = false;
    this.isViewMode = false;
    this.resetForm();
    this.userForm.enable();
  }

  viewUser(user: ExtendedUser): void {
    this.selectedUser = user;
    this.isEditMode = false;
    this.isViewMode = true;
    this.currentView = 'form';
    
    this.userForm.patchValue({
      nombres: user.nombres || '',
      apellidos: user.apellidos || '',
      usuario: user.usuario || '',
      password: '',
      confirmPassword: '',
      correo: user.correo || '',
      confirmCorreo: user.correo || '',
      puesto: user.puesto || '',
      telinstitucional: user.telinstitucional || '+502 ',
      extension: user.extension || '',
      telPersonal: user.telefonopersonal || '+502 ',
      contactoEmergencia: user.nombrecontactoemergencia || '',
      telEmergencia: user.telefonoemergencia || '+502 ',
      profesion: user.profesion || '',
      fechaNacimiento: user.fechanacimiento ? this.formatDateForInput(user.fechanacimiento) : '',
      role: user.fkrol?.toString() || '',
      observaciones: user.observaciones || '',
      status: user.estado?.toString() || ''
    });

    if (user.rutafotoperfil) {
      this.photoPreview = this.archivoService.obtenerUrlPublica(user.rutafotoperfil);
    } else {
      this.photoPreview = null;
    }

    this.userForm.disable();
  }

  formatDateForInput(dateString: string | null | undefined): string {
    if (!dateString) return '';
    
    try {
      const cleanDate = dateString.toString().trim();
      
      if (cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return cleanDate;
      }
      
      // Si viene con hora (YYYY-MM-DDTHH:mm:ss), extraer solo la fecha
      if (cleanDate.includes('T')) {
        const dateOnly = cleanDate.split('T')[0];
        return dateOnly;
      }
      
      // Para cualquier otro formato, intentar crear fecha local
      const dateMatch = cleanDate.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        const [, year, month, day] = dateMatch;
        const formatted = `${year}-${month}-${day}`;
        return formatted;
      }
      
      return '';
      
    } catch (error) {
      return '';
    }
  }

  // Método auxiliar para formatear fecha de vuelta (del input al formato de BD)
  formatDateForDatabase(dateString: string): string {
    if (!dateString || dateString.trim() === '') {
      return '';
    }
    
    try {
      // Si ya está en formato YYYY-MM-DD, crear ISO string para Prisma
      if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Crear fecha a medianoche UTC para evitar problemas de zona horaria
        const date = new Date(dateString + 'T00:00:00.000Z');
        
        if (isNaN(date.getTime())) {
          console.error('Fecha inválida:', dateString);
          return '';
        }
        
        // Devolver en formato ISO para Prisma
        return date.toISOString();
      }
      
      console.error('Formato de fecha no reconocido:', dateString);
      return '';
      
    } catch (error) {
      console.error('Error procesando fecha:', error);
      return '';
    }
  }

  editUser(user: ExtendedUser): void {
    this.selectedUser = user;
    this.isEditMode = true;
    this.isViewMode = false;
    this.currentView = 'form';

    this.updatePasswordValidators();
    
    this.userForm.patchValue({
      nombres: user.nombres || '',
      apellidos: user.apellidos || '',
      usuario: user.usuario || '',
      password: '',
      confirmPassword: '',
      correo: user.correo || '',
      confirmCorreo: user.correo || '',
      puesto: user.puesto || '',
      telinstitucional: user.telinstitucional || '+502 ',
      extension: user.extension || '',
      telPersonal: user.telefonopersonal || '+502 ',
      contactoEmergencia: user.nombrecontactoemergencia || '',
      telEmergencia: user.telefonoemergencia || '+502 ',
      profesion: user.profesion || '',
      fechaNacimiento: user.fechanacimiento ? this.formatDateForInput(user.fechanacimiento) : '',
      role: user.fkrol?.toString() || '',
      observaciones: user.observaciones || '',
      status: user.estado?.toString() || ''
    });
    
    if (user.rutafotoperfil) {
      this.photoPreview = this.archivoService.obtenerUrlPublica(user.rutafotoperfil);
    } else {
      this.photoPreview = null;
    }

    this.userForm.enable();
  }

  updatePasswordValidators(): void {
    const passwordControl = this.userForm.get('password');
    const confirmPasswordControl = this.userForm.get('confirmPassword');
    
    if (this.isEditMode) {
      // En modo edición: contraseñas opcionales
      passwordControl?.setValidators([]);
      confirmPasswordControl?.setValidators([]);
    } else {
      // En modo creación: contraseñas requeridas
      passwordControl?.setValidators([Validators.required]);
      confirmPasswordControl?.setValidators([Validators.required]);
    }
    
    // Actualizar el estado de validación
    passwordControl?.updateValueAndValidity();
    confirmPasswordControl?.updateValueAndValidity();
  }

  // BÚSQUEDA Y FILTRADO - Actualizado para incluir paginación
  filterUsers(): void {
    if (!this.searchTerm.trim()) {
      this.filteredUsers = [...this.users];
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredUsers = this.users.filter(user => {
        const nombreCompleto = `${user.nombres || ''} ${user.apellidos || ''}`.toLowerCase();
        
        return (
          nombreCompleto.includes(term) ||
          (user.correo && user.correo.toLowerCase().includes(term))
        );
      });
    }
    
    this.currentPage = 1;
    this.updatePagination();
  }

  // OPERACIONES CRUD - Actualizado para incluir paginación

  loadUsers(): void {
    this.loading = true;
    this.UsuarioService.obtenerUsuarios().subscribe({
      next: (users) => {
        // Agregar URLs manualmente sin cambiar interface
        this.users = users.map(user => ({
          ...user,
          fotoUrl: user.rutafotoperfil ? this.archivoService.obtenerUrlPublica(user.rutafotoperfil) : null
          // documentoUrl: user.rutadocumento ? this.archivoService.obtenerUrlPublica(user.rutadocumento) : null
        }));
        
        this.filteredUsers = [...this.users];
        this.updatePagination();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.loading = false;
      }
    });
  }

  async deleteUser(id: number): Promise<void> {
    const confirmed = await this.alerta.alertaConfirmacion(
      '¿Estás seguro de que deseas eliminar este usuario?',
      '',
      'Sí, eliminar',
      'No, cancelar'
    );

    if (confirmed) {
      this.UsuarioService.eliminarUsuario(id).subscribe({
        next: (response) => {
          if (response && response.success === false) {
            this.alerta.alertaError(response.message || 'Error al eliminar el usuario');
            return;
          }
          
          this.loadUsers();
          this.alerta.alertaExito('Usuario eliminado correctamente');
        },
        error: (error) => {
          console.error('Error no manejado al eliminar:', error);
          
          let mensajeError = '';
          
          // Verificar si el error tiene la estructura de respuesta del backend
          if (error.error && error.error.message) {
            mensajeError = error.error.message;
          } else if (error.status) {
            // Error basado en código de estado HTTP
            switch (error.status) {
              case 400:
                mensajeError = 'No se puede eliminar este usuario';
                break;
              case 401:
                mensajeError = 'No tienes permisos para eliminar usuarios';
                break;
              case 404:
                mensajeError = 'Usuario no encontrado';
                break;
              case 409:
                mensajeError = 'No se puede eliminar el usuario porque tiene datos relacionados';
                break;
              case 500:
                mensajeError = 'Error interno del servidor. Intenta más tarde';
                break;
              case 0:
                mensajeError = 'Sin conexión al servidor. Verifica tu conexión a internet';
                break;
              default:
                mensajeError = `Error del servidor (${error.status})`;
            }
          } else {
            mensajeError = 'Error al eliminar el usuario';
          }
          
          this.alerta.alertaError(mensajeError);
        }
      });
    }
  }

  closeModal(): void {
    this.currentView = 'list';
    this.isViewMode = false;
    this.resetForm();
    this.selectedPhoto = null;
    this.userForm.enable();
  }

  resetForm(): void {
    this.userForm.reset();
    this.userForm.patchValue({ 
      status: '',
      role: '',
      telinstitucional: '+502 ', 
      telPersonal: '+502 ', 
      telEmergencia: '+502 '
    });
    this.isEditMode = false;
    this.isViewMode = false;
    this.selectedUser = null;
    this.updatePasswordValidators();
    this.userForm.enable();

    this.selectedPhoto = null;
    this.selectedDocument = null;
    this.photoPreview = null;
    this.documentInfo = null;
  }

  async onSubmit(): Promise<void> {
    if (this.userForm.valid) {
      this.loading = true;
      
      const formData = this.userForm.value;
      
      // Tus validaciones existentes se mantienen igual
      if (!this.isEditMode || (formData.password && formData.password.trim() !== '')) {
        if (formData.password !== formData.confirmPassword) {
          this.alerta.alertaError('Las contraseñas no coinciden');
          this.loading = false;
          return;
        }
      }
      
      if (formData.correo !== formData.confirmCorreo) {
        this.alerta.alertaError('Los correos no coinciden');
        this.loading = false;
        return;
      }
      
      try {
        // 1. SUBIR ARCHIVOS PRIMERO (si hay)
        let rutaFoto = '';
        let rutaDocumento = '';
        
        const usuarioId = this.selectedUser?.idusuario || 0; // Para creación usar 0
        
        if (this.selectedPhoto || this.selectedDocument) {
          const archivos: { foto?: File, documento?: File } = {};
          if (this.selectedPhoto) archivos.foto = this.selectedPhoto;
          if (this.selectedDocument) archivos.documento = this.selectedDocument;
          
          const resultadoArchivos = await this.archivoService.subirArchivos('usuarios', usuarioId, archivos);
          rutaFoto = resultadoArchivos.rutaFoto || '';
          rutaDocumento = resultadoArchivos.rutaDocumento || '';
        }

        const userData: Omit<Usuario, 'idusuario'> = {
          fkrol: parseInt(formData.role),
          usuario: formData.usuario,
          clave: (this.isEditMode && (!formData.password || formData.password.trim() === '')) 
            ? this.selectedUser!.clave
            : formData.password,
          nombres: formData.nombres,
          apellidos: formData.apellidos,
          fechanacimiento: this.formatDateForDatabase(formData.fechaNacimiento),
          correo: formData.correo,
          puesto: formData.puesto,
          profesion: formData.profesion || '',
          telinstitucional: formData.telinstitucional || '',
          extension: formData.extension || '',
          telefonopersonal: formData.telPersonal || '',
          nombrecontactoemergencia: formData.contactoEmergencia || '',
          telefonoemergencia: formData.telEmergencia || '',
          rutafotoperfil: rutaFoto || (this.selectedUser?.rutafotoperfil || ''),
          observaciones: formData.observaciones || '',
          usuariocreacion: '1',
          estado: parseInt(formData.status)
        };

        const operation = this.isEditMode 
          ? this.UsuarioService.actualizarUsuario(this.selectedUser!.idusuario, userData)
          : this.UsuarioService.crearUsuario(userData);
          
        operation.subscribe({
          next: (response) => {
            this.loading = false;
            
            if (response && response.success === false) {            
              let mensajeError = '';
              
              if (response.errors && Array.isArray(response.errors) && response.errors.length > 0) {
                mensajeError = response.errors[0].msg || response.errors[0].message || response.errors[0];
              } else if (response.message) {
                mensajeError = response.message;
              } else {
                mensajeError = 'Error de validación';
              }
              
              this.alerta.alertaError(mensajeError);
              return;
            }
            
            const mensaje = this.isEditMode ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente';
            this.loadUsers();
            this.showList();
            this.alerta.alertaExito(mensaje);
          },
          error: (error) => {
            // Tu manejo de errores existente se mantiene igual
            this.loading = false;
            this.alerta.alertaError('Error al procesar la solicitud');
          }
        });

      } catch (error: any) {
        this.loading = false;
        this.alerta.alertaError(error.message);
      }
    } else {
      this.alerta.alertaPreventiva('Completa todos los campos requeridos');
    }
  }
}