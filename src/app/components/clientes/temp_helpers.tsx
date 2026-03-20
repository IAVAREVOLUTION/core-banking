// Función helper para calcular la edad a partir de una fecha de nacimiento
export function calcularEdad(fechaNacimiento: string): number | null {
  if (!fechaNacimiento) return null;
  
  try {
    // Parsear fecha en formato DD/MM/YYYY
    const partes = fechaNacimiento.split('/');
    if (partes.length !== 3) return null;
    
    const dia = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10) - 1; // Meses en JavaScript son 0-indexed
    const anio = parseInt(partes[2], 10);
    
    if (isNaN(dia) || isNaN(mes) || isNaN(anio)) return null;
    
    const fechaNac = new Date(anio, mes, dia);
    const hoy = new Date();
    
    let edad = hoy.getFullYear() - fechaNac.getFullYear();
    const mesActual = hoy.getMonth();
    const diaActual = hoy.getDate();
    
    // Ajustar si aún no ha cumplido años este año
    if (mesActual < mes || (mesActual === mes && diaActual < dia)) {
      edad--;
    }
    
    return edad >= 0 ? edad : null;
  } catch (error) {
    return null;
  }
}
