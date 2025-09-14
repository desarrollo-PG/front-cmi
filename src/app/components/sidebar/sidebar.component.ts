// sidebar.component.ts

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

export interface MenuItem {
  label: string;
  icon?: string;
  route?: string;
  children?: MenuItem[];
  expanded?: boolean;
}

@Component({
  standalone: true,
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  imports: [CommonModule],
})
export class SidebarComponent {
  @Input() isExpanded: boolean = true;
  @Input() userInfo: { name: string; avatar?: string } = { name: 'Usuario' };
  @Input() menuItems: MenuItem[] = [];
  @Input() footerText: string = '© 2025 CMI - Clinicas Municipales Inclusivas. Todos los derechos reservados.';

  @Output() toggleSidebar = new EventEmitter<boolean>();
  @Output() menuItemClick = new EventEmitter<MenuItem>();

  defaultMenuItems: MenuItem[] = [
    {
      label: 'Gestión de usuarios',
      icon: 'fas fa-users',
      children: [
        { label: 'Pacientes', route: '/pacientes' },
        { label: 'Expedientes', route: '/expedientes' },
        { label: 'Traslados', route: '/pacientes/traslados' },
        { label: 'Citas', route: '/pacientes/citas' },
        { label: 'Usuarios', route: '/usuario' } 
      ]
    },
    {
      label: 'Gestión de clínica',
      icon: 'fas fa-hospital',
      children: [
        { label: 'Administración', route: '/clinica/admin' },
        { label: 'Educación Inclusiva', route: '/clinica/educacion' },
        { label: 'Fisioterapia', route: '/clinica/fisioterapia' },
        { label: 'Medicina General', route: '/clinica/medicina' },
        { label: 'Nutrición', route: '/clinica/nutricion' },
        { label: 'Psicología', route: '/clinica/psicologia' }
      ]
    },
    {
      label: 'Informes',
      icon: 'fas fa-chart-bar',
      children: [
        { label: 'Informes de pacientes', route: '/informes/pacientes' }
      ]
    },
    {
      label: 'Acerca de',
      icon: 'fas fa-info-circle',
      children: [
        { label: 'Quienes somos', route: '/acerca/nosotros' },
        { label: 'Misión y visión', route: '/acerca/mision' },
        { label: 'Contáctanos', route: '/acerca/contacto' }
      ]
    },
    {
      label: 'Cerrar Sesion',
      icon: 'fas fa-sign-out-alt',
      children: [
        { label: 'Cerrar Sesion', route: '/logout/logout' }
      ]
    }
  ];

  constructor(private router: Router, private http: HttpClient) {}

  get currentMenuItems(): MenuItem[] {
    return this.menuItems.length > 0 ? this.menuItems : this.defaultMenuItems;
  }

  onToggleSidebar() {
    this.isExpanded = !this.isExpanded;
    this.toggleSidebar.emit(this.isExpanded);
  }

  onMenuItemClick(item: MenuItem) {
    if (item.children && item.children.length > 0) {
      item.expanded = !item.expanded;
    } else if (item.route) {
      this.router.navigate([item.route]);
    }
    this.menuItemClick.emit(item);
  }

  onSubMenuItemClick(item: MenuItem) {
    if (item.label === 'Cerrar Sesion') {
      this.logout();
    } else if (item.route) {

      // ✅ AGREGAR navegación
      this.router.navigate([item.route]);
      this.menuItemClick.emit(item);
    } else {
      this.menuItemClick.emit(item);

    }
    this.menuItemClick.emit(item);
  }

  onUserNameClick() {
    this.router.navigate(['/menu']);
  }

  logout() {
    this.http.post('http://localhost:3000/api/auth/logout', {}).subscribe({
      next: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        this.router.navigate(['/login']);
      },
      error: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        this.router.navigate(['/login']);
      }
    });
  }
}
