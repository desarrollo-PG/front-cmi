import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router'; // ← Agregar Router
import { AuthService, CambiarClaveRequest } from '../../services/auth.service';
import { AlertaService } from '../../services/alerta.service';

@Component({
  selector: 'app-cambiar-clave-temporal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './cambiar-clave-temporal.component.html',
  styleUrls: ['./cambiar-clave-temporal.component.css']
})
export class CambiarClaveTemporalComponent implements OnInit {
  cambiarClaveForm!: FormGroup;
  isLoading = false;
  showPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  showTooltip = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private alertaService: AlertaService,
    private router: Router 
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  initForm(): void {
    const currentUser = this.authService.getCurrentUser();
    
    this.cambiarClaveForm = this.fb.group({
      usuario: [currentUser?.usuario || '', [Validators.required]],
      claveActual: ['', [Validators.required]],
      claveNueva: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(12),
        this.passwordComplexityValidator
      ]],
      confirmarClave: ['', [Validators.required]]
    }, { 
      validators: this.passwordMatchValidator 
    });
  }

  passwordComplexityValidator(control: AbstractControl): {[key: string]: any} | null {
    const value = control.value;
    if (!value) return null;

    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasNumeric = /[0-9]/.test(value);
    const hasSpecialChar = /[@$!%*?&]/.test(value);

    const valid = hasUpperCase && hasLowerCase && hasNumeric && hasSpecialChar;
    
    if (!valid) {
      return { 
        passwordComplexity: {
          hasUpperCase,
          hasLowerCase,
          hasNumeric,
          hasSpecialChar
        }
      };
    }
    
    return null;
  }

  passwordMatchValidator(group: AbstractControl): {[key: string]: any} | null {
    const claveNueva = group.get('claveNueva');
    const confirmarClave = group.get('confirmarClave');
    
    if (claveNueva && confirmarClave && claveNueva.value !== confirmarClave.value) {
      confirmarClave.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    return null;
  }

  onSubmit(): void {
    if (this.cambiarClaveForm.valid) {
      this.isLoading = true;
      
      const formData: CambiarClaveRequest = this.cambiarClaveForm.value;

      this.authService.cambiarClaveTemporary(formData).subscribe({
        next: (response) => {
          if (response.success) {
            this.alertaService.alertaExito(response.message);
            
            // ✅ Redirigir después de cambiar la contraseña exitosamente
            setTimeout(() => {
              // Actualizar el estado del usuario en el servicio
              this.authService.actualizarEstadoCambioClave();
              
              // Navegar a la página principal - ajusta esta ruta según tu aplicación
              this.router.navigate(['/menu']); // o la ruta que uses: '/home', '/main', '/'
            }, 1500); // Dar tiempo para que el usuario vea el mensaje
            
          } else {
            this.alertaService.alertaError(response.message);
          }
          this.isLoading = false;
        },
        error: (error) => {
          const mensaje = error.error?.message || 'Error al cambiar la contraseña';
          this.alertaService.alertaError(mensaje);
          this.isLoading = false;
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.cambiarClaveForm.controls).forEach(key => {
      const control = this.cambiarClaveForm.get(key);
      control?.markAsTouched();
    });
  }

  togglePasswordVisibility(field: string): void {
    switch(field) {
      case 'current':
        this.showPassword = !this.showPassword;
        break;
      case 'new':
        this.showNewPassword = !this.showNewPassword;
        break;
      case 'confirm':
        this.showConfirmPassword = !this.showConfirmPassword;
        break;
    }
  }

  onMouseEnter(): void {
    this.showTooltip = true;
  }
  
  onMouseLeave(): void {
    this.showTooltip = false;
  }

  get claveActual() { return this.cambiarClaveForm.get('claveActual'); }
  get claveNueva() { return this.cambiarClaveForm.get('claveNueva'); }
  get confirmarClave() { return this.cambiarClaveForm.get('confirmarClave'); }
}