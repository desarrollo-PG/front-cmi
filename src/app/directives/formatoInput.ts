import { Directive, ElementRef, HostListener, Input, Renderer2 } from '@angular/core';
import { NgControl } from '@angular/forms';

export type InputType = 'letters' | 'numbers' | 'alphanumeric' | 'email' | 'phone' | 'any';

@Directive({
  selector: '[appInputValidator]',
  standalone: true
})
export class formatoInputDirective {

  @Input() inputType: InputType = 'any';
  @Input() maxLength?: number;
  @Input() minLength?: number;
  @Input() allowSpaces: boolean = true;
  @Input() allowSpecialChars: boolean = false;
  @Input() customPattern?: string;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
    private control?: NgControl
  ) {}

  @HostListener('keypress', ['$event'])
  onKeyPress(event: KeyboardEvent): boolean {
    // Solo aplicar validación de caracteres a inputs, no a selects
    if (this.el.nativeElement.tagName.toLowerCase() === 'select') {
      return true;
    }

    // Permitir teclas de control
    if (this.isControlKey(event)) {
      return true;
    }

    // Obtener patrón según el tipo de input
    const pattern = this.getPattern();
    const inputChar = event.key;

    // Verificar si el carácter es válido según el patrón
    if (!pattern.test(inputChar)) {
      event.preventDefault();
      return false;
    }

    // Verificar longitud máxima
    if (this.maxLength && this.el.nativeElement.value.length >= this.maxLength) {
      event.preventDefault();
      return false;
    }

    return true;
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    // Solo aplicar a inputs, no a selects
    if (this.el.nativeElement.tagName.toLowerCase() === 'select') {
      return;
    }

    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text') || '';
    
    // Filtrar el texto pegado según el tipo de input
    let filteredData = this.filterText(pastedData);
    
    // Aplicar longitud máxima si está definida
    if (this.maxLength) {
      const currentLength = this.el.nativeElement.value.length;
      const availableSpace = this.maxLength - currentLength;
      filteredData = filteredData.substring(0, availableSpace);
    }
    
    // Insertar el texto filtrado
    this.insertText(filteredData);
  }

  @HostListener('input', ['$event'])
  onInput(event: any): void {
    // Solo aplicar filtrado a inputs, no a selects
    if (this.el.nativeElement.tagName.toLowerCase() !== 'select') {
      // Aplicar validaciones en tiempo real
      let value = event.target.value;
      
      // Filtrar caracteres no válidos
      value = this.filterText(value);
      
      // Aplicar longitud máxima
      if (this.maxLength && value.length > this.maxLength) {
        value = value.substring(0, this.maxLength);
      }
      
      // Actualizar el valor si cambió
      if (event.target.value !== value) {
        event.target.value = value;
        // Disparar evento para que Angular detecte el cambio
        event.target.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    
    // Aplicar estilos de validación visual (para ambos inputs y selects)
    this.applyValidationStyles();
    this.styleErrorMessages();
  }

  @HostListener('change', ['$event'])
  onChange(event: any): void {
    // Este evento es principalmente para selects
    const elementType = this.el.nativeElement.tagName.toLowerCase();
    
    // Aplicar estilos de validación visual
    this.applyValidationStyles();
    this.styleErrorMessages();
  }

  @HostListener('blur', ['$event'])
  onBlur(): void {
    this.applyValidationStyles();
    this.styleErrorMessages();
  }

  @HostListener('focus', ['$event'])
  onFocus(): void {
    // Remover estilos de error al enfocar (para ambos inputs y selects)
    this.renderer.removeClass(this.el.nativeElement, 'invalid');
  }

  private isControlKey(event: KeyboardEvent): boolean {
    // Permitir teclas de control
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return true;
    }

    // Permitir teclas especiales
    const specialKeys = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 
      'Home', 'End', 'ArrowLeft', 'ArrowRight', 'Clear'
    ];
    
    return specialKeys.includes(event.key);
  }

  private getPattern(): RegExp {
    if (this.customPattern) {
      return new RegExp(this.customPattern);
    }

    switch (this.inputType) {
      case 'letters':
        if (this.allowSpaces) {
          return /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]$/;
        } else {
          return /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]$/;
        }
      
      case 'numbers':
        return /^[0-9]$/;
      
      case 'alphanumeric':
        if (this.allowSpaces) {
          return /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s]$/;
        } else {
          return /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]$/;
        }
      
      case 'email':
        return /^[a-zA-Z0-9@._-]$/;
      
      case 'phone':
        return /^[0-9+\s()-]$/;
      
      case 'any':
      default:
        return /^.$/; // Permite cualquier carácter
    }
  }

  private filterText(text: string): string {
    if (this.customPattern) {
      const regex = new RegExp(this.customPattern, 'g');
      return text.match(regex)?.join('') || '';
    }

    switch (this.inputType) {
      case 'letters':
        if (this.allowSpaces) {
          return text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
        } else {
          return text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/g, '');
        }
      
      case 'numbers':
        return text.replace(/[^0-9]/g, '');
      
      case 'alphanumeric':
        if (this.allowSpaces) {
          return text.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
        } else {
          return text.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]/g, '');
        }
      
      case 'email':
        return text.replace(/[^a-zA-Z0-9@._-]/g, '');
      
      case 'phone':
        return text.replace(/[^0-9+\s()-]/g, '');
      
      case 'any':
      default:
        return text;
    }
  }

  private insertText(filteredData: string): void {
    const element = this.el.nativeElement;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const currentValue = element.value;
    
    const newValue = currentValue.substring(0, start) + filteredData + currentValue.substring(end);
    
    // Verificar longitud máxima total
    if (this.maxLength && newValue.length > this.maxLength) {
      return;
    }
    
    element.value = newValue;
    element.setSelectionRange(start + filteredData.length, start + filteredData.length);
    
    // Disparar evento input para que Angular detecte el cambio
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  private applyValidationStyles(): void {
    if (!this.control) return;

    const isInvalid = this.control.invalid && (this.control.dirty || this.control.touched);
    
    if (isInvalid) {
      this.renderer.addClass(this.el.nativeElement, 'invalid');
      this.renderer.addClass(this.el.nativeElement, 'field-error');
      // Forzar el estilo con !important mediante el atributo style
      this.renderer.setStyle(this.el.nativeElement, 'border', '2px solid #dc3545', 1);
      this.renderer.setStyle(this.el.nativeElement, 'background-color', '#fff5f5', 1);
      // Agregar animación
      this.renderer.setStyle(this.el.nativeElement, 'animation', 'shake 0.3s ease-in-out', 1);
    } else {
      this.renderer.removeClass(this.el.nativeElement, 'invalid');
      this.renderer.removeClass(this.el.nativeElement, 'field-error');
      // Remover estilos inline cuando es válido
      this.renderer.removeStyle(this.el.nativeElement, 'border');
      this.renderer.removeStyle(this.el.nativeElement, 'background-color');
      this.renderer.removeStyle(this.el.nativeElement, 'animation');
    }
  }

  private styleErrorMessages(): void {
    // Obtener el nombre del campo actual y tipo de elemento
    const fieldName = this.el.nativeElement.getAttribute('formControlName') || 'unknown';
    const elementType = this.el.nativeElement.tagName.toLowerCase();
    
    let errorMessage: Element | null = null;
    
    // MÉTODO 1: Buscar en el contenedor form-group más cercano
    const formGroup = this.el.nativeElement.closest('.form-group');
    if (formGroup) {
      // Buscar .error-message específicamente en este form-group
      errorMessage = formGroup.querySelector('.error-message');
      
      if (!errorMessage) {
        // Buscar por contenido específico del campo (ampliado para selects)
        const allDivs = formGroup.querySelectorAll('div');
        for (const div of allDivs) {
          const text = div.textContent || '';
          const isErrorText = text.includes('requerido') || 
                             text.includes('válido') || 
                             text.includes('permiten') ||
                             text.includes('números') ||
                             text.includes('letras') ||
                             text.includes('Seleccione') ||
                             text.includes('Estado') ||
                             text.includes('Rol') ||
                             text.toLowerCase().includes('campo') ||
                             text.toLowerCase().includes('error');
          
          if (isErrorText) {
            errorMessage = div;
            break;
          }
        }
      }
    }
    
    // MÉTODO 2: Si no encontramos en form-group, buscar como hermano siguiente
    if (!errorMessage) {
      let nextElement = this.el.nativeElement.nextElementSibling;
      let attempts = 0;
      
      while (nextElement && attempts < 3) {
        const text = nextElement.textContent || '';
        const isErrorText = text.includes('requerido') || 
                           text.includes('válido') || 
                           text.includes('permiten') ||
                           text.includes('números') ||
                           text.includes('letras') ||
                           text.includes('Seleccione') ||
                           text.toLowerCase().includes('campo');
        
        if (isErrorText) {
          errorMessage = nextElement;
          break;
        }
        
        nextElement = nextElement.nextElementSibling;
        attempts++;
      }
    }
    
    // Aplicar estilos solo si encontramos EL mensaje específico de ESTE campo
    if (errorMessage) {
      // Marcar este mensaje como procesado para evitar conflictos
      const processedAttr = `processed-${elementType}-${fieldName}`;
      if (errorMessage.hasAttribute(processedAttr)) {
        return;
      }
      
      // Aplicar estilos específicos
      this.renderer.setStyle(errorMessage, 'color', '#dc3545', 1);
      this.renderer.setStyle(errorMessage, 'font-size', '0.75rem', 1);
      this.renderer.setStyle(errorMessage, 'font-weight', '400', 1);
      this.renderer.setStyle(errorMessage, 'margin-top', '0.25rem', 1);
      this.renderer.setStyle(errorMessage, 'margin-bottom', '0', 1);
      this.renderer.setStyle(errorMessage, 'display', 'block', 1);
      this.renderer.setStyle(errorMessage, 'line-height', '1.2', 1);
      
      // Marcar como procesado
      this.renderer.setAttribute(errorMessage, processedAttr, 'true');
      this.renderer.addClass(errorMessage, 'error-message');
    } else {
      // Intentar con un pequeño delay por si el mensaje aparece después
      setTimeout(() => {
        this.retryStyleErrorMessage(fieldName, elementType);
      }, 50);
    }

    // Agregar la animación shake como CSS si no existe
    this.addShakeAnimation();
  }

  // Método para reintentar después de un delay
  private retryStyleErrorMessage(fieldName: string, elementType: string = 'input'): void {
    const formGroup = this.el.nativeElement.closest('.form-group');
    if (!formGroup) return;
    
    const allDivs = formGroup.querySelectorAll('div');
    for (const div of allDivs) {
      const text = div.textContent || '';
      const isErrorText = text.includes('requerido') || 
                         text.includes('válido') || 
                         text.includes('permiten') ||
                         text.includes('números') ||
                         text.includes('letras') ||
                         text.includes('Seleccione') ||
                         text.toLowerCase().includes('campo');
      
      if (isErrorText && !div.hasAttribute(`processed-${elementType}-${fieldName}`)) {
        this.renderer.setStyle(div, 'color', '#dc3545', 1);
        this.renderer.setStyle(div, 'font-size', '0.75rem', 1);
        this.renderer.setStyle(div, 'font-weight', '400', 1);
        this.renderer.setStyle(div, 'margin-top', '0.25rem', 1);
        this.renderer.setStyle(div, 'margin-bottom', '0', 1);
        this.renderer.setStyle(div, 'display', 'block', 1);
        this.renderer.setStyle(div, 'line-height', '1.2', 1);
        
        this.renderer.setAttribute(div, `processed-${elementType}-${fieldName}`, 'true');
        this.renderer.addClass(div, 'error-message');
        break;
      }
    }
  }

  private applyStylesToElement(element: Element): void {
    this.renderer.setStyle(element, 'color', '#dc3545', 1);
    this.renderer.setStyle(element, 'font-size', '0.75rem', 1);
    this.renderer.setStyle(element, 'font-weight', '400', 1);
    this.renderer.setStyle(element, 'margin-top', '0.25rem', 1);
    this.renderer.setStyle(element, 'margin-bottom', '0', 1);
    this.renderer.setStyle(element, 'display', 'block', 1);
    this.renderer.setStyle(element, 'line-height', '1.2', 1);
    this.renderer.addClass(element, 'error-message');
  }

  private addShakeAnimation(): void {
    // Verificar si ya existe la animación en el documento
    const styleId = 'shake-animation-styles';
    if (document.getElementById(styleId)) return;

    // Crear el elemento style
    const style = this.renderer.createElement('style');
    this.renderer.setAttribute(style, 'id', styleId);
    this.renderer.setProperty(style, 'textContent', `
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-2px); }
        75% { transform: translateX(2px); }
      }
    `);

    // Agregar al head del documento
    this.renderer.appendChild(document.head, style);
  }

  // Métodos públicos para usar desde el componente
  public validateField(): boolean {
    if (!this.control) return true;
    
    const value = this.el.nativeElement.value;
    
    // Validar longitud mínima
    if (this.minLength && value.length < this.minLength) {
      return false;
    }
    
    // Validar longitud máxima
    if (this.maxLength && value.length > this.maxLength) {
      return false;
    }
    
    // Validar patrón
    if (value && !this.getPattern().test(value)) {
      return false;
    }
    
    return true;
  }

  public getErrorMessage(): string {
    if (!this.control || !this.control.errors) return '';

    const errors = this.control.errors;
    
    if (errors['required']) {
      return 'Este campo es requerido';
    }
    if (errors['email']) {
      return 'Ingrese un correo válido';
    }
    if (errors['minlength']) {
      return `Mínimo ${errors['minlength'].requiredLength} caracteres`;
    }
    if (errors['maxlength']) {
      return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
    }
    
    // Mensajes según el tipo de input
    switch (this.inputType) {
      case 'letters':
        return 'Solo se permiten letras y espacios';
      case 'numbers':
        return 'Solo se permiten números';
      case 'alphanumeric':
        return 'Solo se permiten letras y números';
      case 'email':
        return 'Formato de correo inválido';
      case 'phone':
        return 'Formato de teléfono inválido';
      default:
        return 'Campo inválido';
    }
  }
}