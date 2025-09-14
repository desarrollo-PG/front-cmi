import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router'; 
import { SidebarComponent, MenuItem as SidebarMenuItem } from '../sidebar/sidebar.component'; 
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import { ArchivoService } from '../../services/archivo.service';

interface MenuItem {
  id: string;
  title: string;
  icon: string;
  description: string;
  tooltip: string;
}

@Component({
  standalone: true,
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
  imports: [CommonModule, SidebarComponent]
})
export class MenuComponent implements OnInit, OnDestroy, AfterViewInit {
  // Estado del sidebar (visible/oculto)
  sidebarVisible = false;
  sidebarExpanded = true;
  userInfo: any = {};

  // ✅ Propiedad para mensaje de bienvenida
  showWelcomeMessage = false;

  // ✅ Suscripción para cleanup
  private welcomeSubscription?: Subscription;

  // Estado del modal
  modalVisible = false;
  selectedItem: MenuItem | null = null;

  // Estado del tooltip
  hoveredItem: MenuItem | null = null;
  tooltipPosition = { x: 0, y: 0 };

  constructor(
    private authService: AuthService,
    private archivoService: ArchivoService,
    private router: Router 
  ) {}

  ngOnInit() {
    this.loadUserInfo();
    const storedUser = localStorage.getItem('usuario');
    if (storedUser) {
      const user = JSON.parse(storedUser);
    }

    // ESCUCHAR cuando debe mostrar bienvenida
    this.welcomeSubscription = this.authService.showWelcome$.subscribe(() => {
      this.showWelcomeMessage = true;
      setTimeout(() => {
        this.hideWelcomeMessage();
      }, 5000);
    });
  }

  ngOnDestroy() {
    // Cleanup de suscripción
    this.welcomeSubscription?.unsubscribe();
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

  // Método para ocultar mensaje
  hideWelcomeMessage(): void {
    this.showWelcomeMessage = false;
  }

  // Lista de botones del menú
  menuItems: MenuItem[] = [
    {
      id: 'innovation',
      title: 'Innovación',
      icon: 'fas fa-lightbulb',
      description: 'Gestión de ideas innovadoras y proyectos creativos para el desarrollo municipal.',
      tooltip: 'Ideas y proyectos innovadores'
    },
    {
      id: 'buildings',
      title: 'Edificios',
      icon: 'fas fa-building',
      description: 'Administración y gestión de edificios e infraestructura municipal.',
      tooltip: 'Gestión de infraestructura'
    },
    {
      id: 'contact',
      title: 'Contacto',
      icon: 'fas fa-phone',
      description: 'Directorio de contactos y canales de comunicación ciudadana.',
      tooltip: 'Información de contacto'
    },
    {
      id: 'statistics',
      title: 'Estadísticas',
      icon: 'fas fa-chart-bar',
      description: 'Análisis de datos y estadísticas municipales para la toma de decisiones.',
      tooltip: 'Datos y análisis municipales'
    },
    {
      id: 'global',
      title: 'Global',
      icon: 'fas fa-globe',
      description: 'Conectividad global y relaciones internacionales del municipio.',
      tooltip: 'Conexiones internacionales'
    },
    {
      id: 'awards',
      title: 'Reconocimientos',
      icon: 'fas fa-trophy',
      description: 'Logros, premios y reconocimientos obtenidos por el municipio.',
      tooltip: 'Logros y reconocimientos'
    }
  ];

  // Mostrar/ocultar sidebar
  toggleSidebar(): void {
    this.sidebarVisible = !this.sidebarVisible;
  }

  // ✅ NUEVO: Manejar clicks del sidebar
  onSidebarMenuItemClick(item: SidebarMenuItem): void {
    if (item.route) {
      this.router.navigate([item.route]);
      
      // Opcional: cerrar sidebar en móviles después de navegar
      if (window.innerWidth <= 768) {
        this.sidebarVisible = false;
      }
    }
  }

  // ✅ NUEVO: Manejar toggle del sidebar desde el sidebar component
  onSidebarToggle(isExpanded: boolean): void {
    this.sidebarVisible = isExpanded;
  }

  // Abrir modal con detalle del botón (para el menú principal)
  onMenuItemClick(item: MenuItem): void {
    this.selectedItem = item;
    this.modalVisible = true;
  }

  // Cerrar modal
  closeModal(): void {
    this.modalVisible = false;
    this.selectedItem = null;
  }

  // Mostrar tooltip al pasar el mouse
  onMouseEnter(event: MouseEvent, item: MenuItem): void {
    this.hoveredItem = item;
    this.updateTooltipPosition(event);
  }

  // Ocultar tooltip al salir del mouse
  onMouseLeave(): void {
    this.hoveredItem = null;
  }

  // Actualizar posición del tooltip al mover el mouse
  onMouseMove(event: MouseEvent): void {
    if (this.hoveredItem) {
      this.updateTooltipPosition(event);
    }
  }

  // Calcular posición del tooltip
  private updateTooltipPosition(event: MouseEvent): void {
    this.tooltipPosition = {
      x: event.clientX + 10,
      y: event.clientY - 10
    };
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
}