import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-pantalla-bienvenida',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pantallaBienvenida.component.html',    
  styleUrls: ['./pantallaBienvenida.component.scss']     
})
export class PantallaBienvenidaComponent implements OnInit {
  nombreUsuario: string = '';
  progreso: number = 0;

  constructor(private router: Router) {}

  ngOnInit() {
    // Obtener nombre del usuario desde localStorage
    const usuarioGuardado = localStorage.getItem('usuario');
    if (usuarioGuardado) {
      const usuario = JSON.parse(usuarioGuardado);
      this.nombreUsuario = `${usuario.nombres} ${usuario.apellidos}`;  
    }

    // Simular progreso de carga
    this.simularCarga();
  }

  private simularCarga() {
    const intervalo = setInterval(() => {
      this.progreso += 20;
      
      if (this.progreso >= 100) {
        clearInterval(intervalo);
        setTimeout(() => {
          this.router.navigate(['/menu']);
        }, 500);
      }
    }, 300);
  }
}