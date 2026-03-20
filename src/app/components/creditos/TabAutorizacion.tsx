import { useState, useEffect } from 'react';

interface TabAutorizacionProps {
  mode: 'nuevo' | 'editar' | 'ver';
  camposEditables: boolean;
  archivosExpediente: any[];
  datosCredito: any;
}

export function TabAutorizacion({
  mode,
  camposEditables,
  archivosExpediente,
  datosCredito
}: TabAutorizacionProps) {
  
  const [autorizacion, setAutorizacion] = useState({
    fechaAutorizacion: '',
    usuarioAutoriza: '',
    area: '',
    descripcion: '',
    observaciones: '',
    estatus: 'Pendiente'
  });

  // Estilo de inputs según modo
  const inputClass = mode === 'nuevo'
    ? 'w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white'
    : 'w-full px-2 py-1 text-xs border-0 bg-transparent';

  const selectClass = mode === 'nuevo'
    ? 'w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white'
    : 'w-full px-2 py-1 text-xs border-0 bg-transparent';

  useEffect(() => {
    // Valores por defecto en modo nuevo
    if (mode === 'nuevo') {
      const ahora = new Date();
      const dia = ahora.getDate().toString().padStart(2, '0');
      const mes = (ahora.getMonth() + 1).toString().padStart(2, '0');
      const anio = ahora.getFullYear();
      const horas = ahora.getHours().toString().padStart(2, '0');
      const minutos = ahora.getMinutes().toString().padStart(2, '0');
      const segundos = ahora.getSeconds().toString().padStart(2, '0');
      const fechaHora = `${dia}/${mes}/${anio} ${horas}:${minutos}:${segundos}`;

      setAutorizacion({
        fechaAutorizacion: fechaHora,
        usuarioAutoriza: '',
        area: '',
        descripcion: '',
        observaciones: '',
        estatus: 'Pendiente'
      });
    } else {
      // Valores precargados en editar/ver
      setAutorizacion({
        fechaAutorizacion: '08/08/2022 10:38:47',
        usuarioAutoriza: 'EMP-001 Emilio Camarena',
        area: 'Gerencia',
        descripcion: 'Autorización del crédito',
        observaciones: 'Sin Observaciones',
        estatus: 'Pendiente'
      });
    }
  }, [mode]);

  return (
    <div className="p-4">
      {/* ENCABEZADO CON TÍTULO Y BOTÓN ASISTENTE */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm text-gray-700">Autorización</h3>
        <button className="px-4 py-1 bg-[#5B9BD5] text-white rounded text-xs hover:bg-[#4A8BC5]">
          Asistente
        </button>
      </div>

      {/* FILA ÚNICA CON TODOS LOS CAMPOS */}
      <div className="grid grid-cols-6 gap-3">
        {/* FECHA Y HORA DE AUTORIZACIÓN */}
        <div>
          <label className="block text-xs text-gray-600 mb-1">Fecha y hora de Autorización</label>
          <input
            type="text"
            value={autorizacion.fechaAutorizacion}
            onChange={(e) => setAutorizacion(prev => ({ ...prev, fechaAutorizacion: e.target.value }))}
            className={inputClass}
            disabled
            readOnly
          />
        </div>

        {/* USUARIO QUE AUTORIZÓ */}
        <div>
          <label className="block text-xs text-gray-600 mb-1">Usuario que Autorizó</label>
          <input
            type="text"
            value={autorizacion.usuarioAutoriza}
            onChange={(e) => setAutorizacion(prev => ({ ...prev, usuarioAutoriza: e.target.value }))}
            className={inputClass}
            disabled
            readOnly
            placeholder="EMP-001 Emilio Camarena"
          />
        </div>

        {/* ÁREA */}
        <div>
          <label className="block text-xs text-gray-600 mb-1">Área</label>
          <input
            type="text"
            value={autorizacion.area}
            onChange={(e) => setAutorizacion(prev => ({ ...prev, area: e.target.value }))}
            className={inputClass}
            disabled
            readOnly
            placeholder="Gerencia"
          />
        </div>

        {/* DESCRIPCIÓN DE LA AUTORIZACIÓN */}
        <div>
          <label className="block text-xs text-gray-600 mb-1">Descripción de la autorización</label>
          <input
            type="text"
            value={autorizacion.descripcion}
            onChange={(e) => setAutorizacion(prev => ({ ...prev, descripcion: e.target.value }))}
            className={inputClass}
            disabled={!camposEditables || mode === 'ver'}
            placeholder="Autorización del crédito"
            maxLength={255}
          />
        </div>

        {/* OBSERVACIONES */}
        <div>
          <label className="block text-xs text-gray-600 mb-1">Observaciones</label>
          <input
            type="text"
            value={autorizacion.observaciones}
            onChange={(e) => setAutorizacion(prev => ({ ...prev, observaciones: e.target.value }))}
            className={inputClass}
            disabled={!camposEditables || mode === 'ver'}
            placeholder="Sin Observaciones"
            maxLength={255}
          />
        </div>

        {/* ESTATUS */}
        <div>
          <label className="block text-xs text-gray-600 mb-1">Estatus</label>
          <select
            value={autorizacion.estatus}
            onChange={(e) => setAutorizacion(prev => ({ ...prev, estatus: e.target.value }))}
            className={selectClass}
            disabled={!camposEditables || mode === 'ver'}
          >
            <option value="Pendiente">Pendiente</option>
            <option value="Autorizado">Autorizado</option>
            <option value="Rechazado">Rechazado</option>
            <option value="En Revisión">En Revisión</option>
          </select>
        </div>
      </div>
    </div>
  );
}