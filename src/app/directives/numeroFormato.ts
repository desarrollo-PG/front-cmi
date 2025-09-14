import { Directive, ElementRef, HostListener, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Directive({
  selector: '[appPhoneFormat]',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FormatoTelefonicoDirective),
      multi: true
    }
  ]
})
export class FormatoTelefonicoDirective implements ControlValueAccessor {
  private onChange = (value: string) => {};
  private onTouched = () => {};

  constructor(private el: ElementRef) {}

  @HostListener('input', ['$event'])
  onInput(event: any): void {
    const input = event.target;
    let value = input.value;
    
    // Obtener solo la parte después de "+502 "
    let userNumbers = '';
    if (value.startsWith('+502 ')) {
      userNumbers = value.substring(5).replace(/[^\d]/g, ''); // Solo números después de +502
    } else {
      userNumbers = value.replace(/[^\d]/g, '');
    }
    
    // Formatear el número
    const formatted = this.formatPhoneNumber(userNumbers);
    
    // Actualizar el valor del input
    input.value = formatted;
    
    // Notificar al formulario del cambio
    this.onChange(formatted);
  }

  @HostListener('focus', ['$event'])
  onFocus(event: any): void {
    const input = event.target;
    // Si el campo está vacío, agregar el prefijo
    if (!input.value || input.value === '') {
      input.value = '+502 ';
      this.onChange('+502 ');
    }
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;
    const cursorPosition = input.selectionStart || 0;
    
    // Prevenir que se borre el prefijo +502
    if ((event.key === 'Backspace' || event.key === 'Delete') && cursorPosition <= 5) {
      event.preventDefault();
    }
  }

  private formatPhoneNumber(userNumbers: string): string {
    // Siempre empezar con +502
    let formatted = '+502 ';
    
    // Limitar a máximo 8 dígitos del usuario
    userNumbers = userNumbers.substring(0, 8);
    
    // Si hay números del usuario, agregarlos con formato
    if (userNumbers.length > 0) {
      if (userNumbers.length <= 4) {
        // Primeros 4 dígitos
        formatted += userNumbers;
      } else {
        // Primeros 4 dígitos + guión + resto (máximo 4 más)
        formatted += userNumbers.substring(0, 4) + '-' + userNumbers.substring(4);
      }
    }
    
    return formatted;
  }

  // Métodos de ControlValueAccessor
  writeValue(value: any): void {
    if (value && value !== '+502 ') {
      // Si viene un valor del formulario, extraer solo los números del usuario
      let userNumbers = '';
      if (typeof value === 'string') {
        if (value.startsWith('+502 ')) {
          userNumbers = value.substring(5).replace(/[^\d]/g, '');
        } else {
          userNumbers = value.replace(/[^\d]/g, '');
        }
      }
      const formatted = this.formatPhoneNumber(userNumbers);
      this.el.nativeElement.value = formatted;
    } else {
      this.el.nativeElement.value = '+502 ';
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.el.nativeElement.disabled = isDisabled;
  }
}