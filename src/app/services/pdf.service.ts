// services/pdf.service.ts - VERSIÓN CORREGIDA
import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Expediente } from './expediente.service';

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  constructor() { }

  /**
   * Genera un PDF completo del expediente médico
   */
  generarPDFExpediente(expediente: Expediente): void {
    const doc = new jsPDF();
    let yPosition = 20;

    // Configurar fuentes
    doc.setFont('helvetica');
    
    // ENCABEZADO
    yPosition = this.agregarEncabezado(doc, yPosition);
    
    // INFORMACIÓN BÁSICA DEL EXPEDIENTE
    yPosition = this.agregarInformacionBasica(doc, expediente, yPosition);
    
    // INFORMACIÓN DEL PACIENTE
    if (expediente.paciente && expediente.paciente.length > 0) {
      yPosition = this.agregarInformacionPaciente(doc, expediente.paciente[0], yPosition);
    }
    
    // ANTECEDENTES MÉDICOS
    if (this.tieneAntecedentes(expediente)) {
      yPosition = this.agregarAntecedentesMedicos(doc, expediente, yPosition);
    }
    
    // ANTECEDENTES FISIOLÓGICOS
    if (this.tieneAntecedentesFisiologicos(expediente)) {
      yPosition = this.agregarAntecedentesFisiologicos(doc, expediente, yPosition);
    }
    
    // ANTECEDENTES GINECO-OBSTÉTRICOS
    if (this.tieneAntecedentesGineObstetricos(expediente)) {
      yPosition = this.agregarAntecedentesGineObstetricos(doc, expediente, yPosition);
    }
    
    // EXAMEN FÍSICO
    if (this.tieneExamenFisico(expediente)) {
      yPosition = this.agregarExamenFisico(doc, expediente, yPosition);
    }
    
    // PIE DE PÁGINA
    this.agregarPiePagina(doc);
    
    // DESCARGAR PDF
    const nombreArchivo = `expediente_${expediente.numeroexpediente}_${this.formatearFecha(new Date())}.pdf`;
    doc.save(nombreArchivo);
  }

  /**
   * Agrega el encabezado del documento
   */
  private agregarEncabezado(doc: jsPDF, yPosition: number): number {
    // Logo y título principal
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(44, 102, 98); // Color verde del tema
    doc.text('EXPEDIENTE MÉDICO', 105, yPosition, { align: 'center' });
    
    // Línea decorativa
    doc.setDrawColor(44, 102, 98);
    doc.setLineWidth(0.5);
    doc.line(20, yPosition + 5, 190, yPosition + 5);
    
    return yPosition + 20;
  }

  /**
   * Agrega información básica del expediente
   */
  private agregarInformacionBasica(doc: jsPDF, expediente: Expediente, yPosition: number): number {
    // Título de sección
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(44, 102, 98);
    doc.text('INFORMACIÓN DEL EXPEDIENTE', 20, yPosition);
    yPosition += 10;
    
    // Datos en tabla
    const datosBasicos = [
      ['Número de Expediente:', expediente.numeroexpediente || 'N/A'],
      ['Fecha de Creación:', this.formatearFecha(expediente.fechacreacion)],
      ['Usuario que Creó:', expediente.usuariocreacion || 'N/A'],
      ['Estado:', expediente.estado === 1 ? 'Activo' : 'Inactivo']
    ];

    if (expediente.usuariomodificacion) {
      datosBasicos.push(['Última Modificación por:', expediente.usuariomodificacion]);
    }
    
    if (expediente.fechamodificacion) {
      datosBasicos.push(['Fecha de Modificación:', this.formatearFecha(expediente.fechamodificacion)]);
    }

    autoTable(doc, {
      startY: yPosition,
      body: datosBasicos,
      theme: 'plain',
      styles: {
        fontSize: 10,
        cellPadding: 3
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { cellWidth: 120 }
      },
      margin: { left: 20 }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;

    // Historia de enfermedad si existe
    if (expediente.historiaenfermedad) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Historia de Enfermedad:', 20, yPosition);
      yPosition += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const lineas = doc.splitTextToSize(expediente.historiaenfermedad, 170);
      doc.text(lineas, 20, yPosition);
      yPosition += lineas.length * 5 + 10;
    }

    return yPosition;
  }

  /**
   * Agrega información del paciente
   */
  private agregarInformacionPaciente(doc: jsPDF, paciente: any, yPosition: number): number {
    // Verificar si necesitamos nueva página
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    // Título de sección
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(44, 102, 98);
    doc.text('INFORMACIÓN DEL PACIENTE', 20, yPosition);
    yPosition += 10;

    const datosPaciente = [
      ['Nombre Completo:', `${paciente.nombres || ''} ${paciente.apellidos || ''}`],
      ['CUI:', paciente.cui || 'N/A'],
      ['Fecha de Nacimiento:', this.formatearFecha(paciente.fechanacimiento)],
      ['Teléfono:', paciente.telefono || 'N/A'],
      ['Dirección:', paciente.direccion || 'N/A']
    ];

    autoTable(doc, {
      startY: yPosition,
      body: datosPaciente,
      theme: 'plain',
      styles: {
        fontSize: 10,
        cellPadding: 3
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { cellWidth: 120 }
      },
      margin: { left: 20 }
    });

    return (doc as any).lastAutoTable.finalY + 15;
  }

  /**
   * Agrega antecedentes médicos
   */
  private agregarAntecedentesMedicos(doc: jsPDF, expediente: Expediente, yPosition: number): number {
    if (yPosition > 200) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(44, 102, 98);
    doc.text('ANTECEDENTES MÉDICOS', 20, yPosition);
    yPosition += 10;

    const antecedentes = [];
    
    if (expediente.antmedico) {
      antecedentes.push(['Antecedentes Médicos:', expediente.antmedico]);
    }
    if (expediente.antmedicamento) {
      antecedentes.push(['Medicamentos:', expediente.antmedicamento]);
    }
    if (expediente.anttraumaticos) {
      antecedentes.push(['Antecedentes Traumáticos:', expediente.anttraumaticos]);
    }
    if (expediente.antfamiliar) {
      antecedentes.push(['Antecedentes Familiares:', expediente.antfamiliar]);
    }
    if (expediente.antalergico) {
      antecedentes.push(['Alergias:', expediente.antalergico]);
    }
    if (expediente.antsustancias) {
      antecedentes.push(['Sustancias:', expediente.antsustancias]);
    }
    if (expediente.antintolerantelactosa !== undefined) {
      const intolerancia = expediente.antintolerantelactosa === 1 ? 'Sí' : 'No';
      antecedentes.push(['Intolerancia a Lactosa:', intolerancia]);
    }

    if (antecedentes.length > 0) {
      autoTable(doc, {
        startY: yPosition,
        body: antecedentes,
        theme: 'plain',
        styles: {
          fontSize: 9,
          cellPadding: 3
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50 },
          1: { cellWidth: 120 }
        },
        margin: { left: 20 }
      });

      return (doc as any).lastAutoTable.finalY + 15;
    }

    return yPosition;
  }

  /**
   * Agrega antecedentes fisiológicos
   */
  private agregarAntecedentesFisiologicos(doc: jsPDF, expediente: Expediente, yPosition: number): number {
    if (yPosition > 200) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(44, 102, 98);
    doc.text('ANTECEDENTES FISIOLÓGICOS', 20, yPosition);
    yPosition += 10;

    const antecedentesFisio = [];
    
    if (expediente.antfisoinmunizacion) {
      antecedentesFisio.push(['Inmunizaciones:', expediente.antfisoinmunizacion]);
    }
    if (expediente.antfisocrecimiento) {
      antecedentesFisio.push(['Crecimiento y Desarrollo:', expediente.antfisocrecimiento]);
    }
    if (expediente.antfisohabitos) {
      antecedentesFisio.push(['Hábitos de Vida:', expediente.antfisohabitos]);
    }
    if (expediente.antfisoalimentos) {
      antecedentesFisio.push(['Hábitos Alimenticios:', expediente.antfisoalimentos]);
    }

    if (antecedentesFisio.length > 0) {
      autoTable(doc, {
        startY: yPosition,
        body: antecedentesFisio,
        theme: 'plain',
        styles: {
          fontSize: 9,
          cellPadding: 3
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50 },
          1: { cellWidth: 120 }
        },
        margin: { left: 20 }
      });

      return (doc as any).lastAutoTable.finalY + 15;
    }

    return yPosition;
  }

  /**
   * Agrega antecedentes gineco-obstétricos
   */
  private agregarAntecedentesGineObstetricos(doc: jsPDF, expediente: Expediente, yPosition: number): number {
    if (yPosition > 200) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(44, 102, 98);
    doc.text('ANTECEDENTES GINECO-OBSTÉTRICOS', 20, yPosition);
    yPosition += 10;

    const gineObs = [];
    
    if (expediente.gineobsprenatales) {
      gineObs.push(['Antecedentes Prenatales:', expediente.gineobsprenatales]);
    }
    if (expediente.gineobsnatales) {
      gineObs.push(['Antecedentes Natales:', expediente.gineobsnatales]);
    }
    if (expediente.gineobspostnatales) {
      gineObs.push(['Antecedentes Postnatales:', expediente.gineobspostnatales]);
    }
    if (expediente.gineobsgestas !== undefined) {
      gineObs.push(['Gestas:', expediente.gineobsgestas.toString()]);
    }
    if (expediente.gineobspartos !== undefined) {
      gineObs.push(['Partos:', expediente.gineobspartos.toString()]);
    }
    if (expediente.gineobsabortos !== undefined) {
      gineObs.push(['Abortos:', expediente.gineobsabortos.toString()]);
    }
    if (expediente.gineobscesareas !== undefined) {
      gineObs.push(['Cesáreas:', expediente.gineobscesareas.toString()]);
    }
    if (expediente.gineobsfur) {
      gineObs.push(['Fecha de Última Regla:', this.formatearFecha(expediente.gineobsfur)]);
    }
    if (expediente.gineobsmenarquia) {
      gineObs.push(['Menarquia:', expediente.gineobsmenarquia]);
    }
    if (expediente.gineobsciclos) {
      gineObs.push(['Ciclos Menstruales:', expediente.gineobsciclos]);
    }

    if (gineObs.length > 0) {
      autoTable(doc, {
        startY: yPosition,
        body: gineObs,
        theme: 'plain',
        styles: {
          fontSize: 9,
          cellPadding: 3
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50 },
          1: { cellWidth: 120 }
        },
        margin: { left: 20 }
      });

      return (doc as any).lastAutoTable.finalY + 15;
    }

    return yPosition;
  }

  /**
   * Agrega datos del examen físico
   */
  private agregarExamenFisico(doc: jsPDF, expediente: Expediente, yPosition: number): number {
    if (yPosition > 200) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(44, 102, 98);
    doc.text('EXAMEN FÍSICO Y SIGNOS VITALES', 20, yPosition);
    yPosition += 10;

    const signosVitales = [];
    
    if (expediente.examenfistc) {
      signosVitales.push(['Temperatura:', `${expediente.examenfistc}°C`]);
    }
    if (expediente.examenfispa) {
      signosVitales.push(['Presión Arterial:', `${expediente.examenfispa} mmHg`]);
    }
    if (expediente.examenfisfc) {
      signosVitales.push(['Frecuencia Cardíaca:', `${expediente.examenfisfc} lpm`]);
    }
    if (expediente.examenfisfr) {
      signosVitales.push(['Frecuencia Respiratoria:', `${expediente.examenfisfr} rpm`]);
    }
    if (expediente.examenfissao2) {
      signosVitales.push(['Saturación de Oxígeno:', `${expediente.examenfissao2}%`]);
    }
    if (expediente.examenfispeso) {
      signosVitales.push(['Peso:', `${expediente.examenfispeso} kg`]);
    }
    if (expediente.examenfistalla) {
      signosVitales.push(['Talla:', `${expediente.examenfistalla} m`]);
    }
    if (expediente.examenfisimc) {
      const categoria = this.obtenerCategoriaIMC(expediente.examenfisimc);
      signosVitales.push(['IMC:', `${expediente.examenfisimc} kg/m² (${categoria})`]);
    }

    if (signosVitales.length > 0) {
      autoTable(doc, {
        startY: yPosition,
        body: signosVitales,
        theme: 'plain',
        styles: {
          fontSize: 10,
          cellPadding: 3
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50 },
          1: { cellWidth: 120 }
        },
        margin: { left: 20 }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }

    // Examen físico general
    if (expediente.examenfisgmt) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Examen Físico General:', 20, yPosition);
      yPosition += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const lineas = doc.splitTextToSize(expediente.examenfisgmt, 170);
      doc.text(lineas, 20, yPosition);
      yPosition += lineas.length * 5 + 10;
    }

    return yPosition;
  }

/**
 * Agrega pie de página
 */
private agregarPiePagina(doc: jsPDF): void {
  // Usar type assertion para acceder al método
  const totalPages = (doc as any).internal.getNumberOfPages();
  
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    // Línea superior del pie
    doc.setDrawColor(44, 102, 98);
    doc.setLineWidth(0.3);
    doc.line(20, 285, 190, 285);
    
    // Texto del pie
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128, 128, 128);
    
    const fechaGeneracion = this.formatearFecha(new Date());
    doc.text(`Generado el ${fechaGeneracion}`, 20, 290);
    doc.text(`Sistema de Expedientes Médicos - Fraijanes`, 105, 290, { align: 'center' });
    doc.text(`Página ${i} de ${totalPages}`, 190, 290, { align: 'right' });
  }
}

  // Resto de métodos auxiliares (sin cambios)...
  
  private tieneAntecedentes(expediente: Expediente): boolean {
    return !!(
      expediente.antmedico || 
      expediente.antmedicamento || 
      expediente.anttraumaticos || 
      expediente.antfamiliar || 
      expediente.antalergico || 
      expediente.antsustancias ||
      expediente.antintolerantelactosa !== undefined
    );
  }

  private tieneAntecedentesFisiologicos(expediente: Expediente): boolean {
    return !!(
      expediente.antfisoinmunizacion ||
      expediente.antfisocrecimiento ||
      expediente.antfisohabitos ||
      expediente.antfisoalimentos
    );
  }

  private tieneAntecedentesGineObstetricos(expediente: Expediente): boolean {
    return !!(
      expediente.gineobsprenatales ||
      expediente.gineobsnatales ||
      expediente.gineobspostnatales ||
      expediente.gineobsgestas !== undefined ||
      expediente.gineobspartos !== undefined ||
      expediente.gineobsabortos !== undefined ||
      expediente.gineobscesareas !== undefined ||
      expediente.gineobsfur ||
      expediente.gineobsmenarquia ||
      expediente.gineobsciclos
    );
  }

  private tieneExamenFisico(expediente: Expediente): boolean {
    return !!(
      expediente.examenfistc ||
      expediente.examenfispa ||
      expediente.examenfisfc ||
      expediente.examenfisfr ||
      expediente.examenfissao2 ||
      expediente.examenfispeso ||
      expediente.examenfistalla ||
      expediente.examenfisimc ||
      expediente.examenfisgmt
    );
  }

  private formatearFecha(fecha: string | Date | undefined): string {
    if (!fecha) return 'N/A';
    
    try {
      const fechaObj = typeof fecha === 'string' ? new Date(fecha) : fecha;
      return fechaObj.toLocaleDateString('es-GT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      return 'Fecha inválida';
    }
  }

  private obtenerCategoriaIMC(imc: number): string {
    if (imc < 18.5) return 'Bajo peso';
    if (imc >= 18.5 && imc < 25) return 'Peso normal';
    if (imc >= 25 && imc < 30) return 'Sobrepeso';
    if (imc >= 30) return 'Obesidad';
    return '';
  }

  /**
   * Genera un reporte de múltiples expedientes (listado)
   */
  generarReporteListaExpedientes(expedientes: Expediente[]): void {
    const doc = new jsPDF();
    
    // Encabezado
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(44, 102, 98);
    doc.text('REPORTE DE EXPEDIENTES MÉDICOS', 105, 20, { align: 'center' });
    
    // Fecha del reporte
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`Generado el: ${this.formatearFecha(new Date())}`, 20, 30);
    doc.text(`Total de expedientes: ${expedientes.length}`, 20, 35);

    // Preparar datos para la tabla
    const headers = [
      'No. Expediente',
      'Paciente',
      'CUI',
      'Fecha Creación',
      'Estado'
    ];

    const rows = expedientes.map(exp => [
      exp.numeroexpediente || 'N/A',
      exp.paciente && exp.paciente.length > 0 ? 
        `${exp.paciente[0].nombres} ${exp.paciente[0].apellidos}` : 'Sin asignar',
      exp.paciente && exp.paciente.length > 0 ? 
        exp.paciente[0].cui : 'N/A',
      this.formatearFecha(exp.fechacreacion),
      exp.estado === 1 ? 'Activo' : 'Inactivo'
    ]);

    // Generar tabla
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 45,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [44, 102, 98],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 45 },
        2: { cellWidth: 30 },
        3: { cellWidth: 30 },
        4: { cellWidth: 25 }
      }
    });

    // Guardar
    const nombreArchivo = `reporte_expedientes_${this.formatearFecha(new Date()).replace(/\//g, '-')}.pdf`;
    doc.save(nombreArchivo);
  }
}