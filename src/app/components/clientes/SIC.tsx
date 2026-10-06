/**
 * Pestaña SIC de Personas: consulta a Buró de Crédito.
 * La lógica y la interfaz viven en shared/ConsultaBuroPanel; aquí sólo se
 * conecta la persistencia por cliente (sessionStorage → guardado del cliente).
 */
import { useClienteSubtabList } from '@/app/hooks/useClientePersistence';
import { ConsultaBuroPanel, type ConsultaBuroRegistro } from '../shared/ConsultaBuroPanel';
import type { DatosConsultaBuro, ResultadoBuro } from '@/app/lib/buroSimulado';

interface SICProps {
  isView?: boolean;
  clienteId?: string;
  datos: DatosConsultaBuro;
  onResultado?: (resultado: ResultadoBuro) => void;
}

export function SIC({ isView = false, clienteId, datos, onResultado }: SICProps) {
  const { items: consultas, setItems: setConsultas } = useClienteSubtabList<ConsultaBuroRegistro>(
    clienteId || 'temp',
    'consultas_sic',
    [],
  );
  return (
    <ConsultaBuroPanel
      consultas={Array.isArray(consultas) ? consultas : []}
      onChange={setConsultas}
      datos={datos}
      isView={isView}
      onResultado={onResultado}
    />
  );
}
