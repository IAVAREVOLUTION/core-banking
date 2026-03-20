import { TasaInversion } from '@/types/tasaInversion';

export const tasasInversion: TasaInversion[] = [
  {
    id: 1,
    tipoProducto: 'Inversión',
    empleado: '3',
    minimoEmpleado: 1,
    tasaMinima: 3.00,
    tasaInicial: 15.00,
    tasaMaxima: 0.50,
    porcentajeIncremento: 0.50,
    inicioVigencia: '1/1/2017 (04:11:41)',
    finVigencia: '3/31/2018 (04:11:18)',
    estatus: 'Activo',
    vigenciaTasas: 'Del 01/01/2017 al 31/03/2018',
    tipoTasa: 'Variable'
  },
  {
    id: 2,
    tipoProducto: 'Inversión Plazo Fijo',
    empleado: '5',
    minimoEmpleado: 2,
    tasaMinima: 4.00,
    tasaInicial: 18.00,
    tasaMaxima: 1.00,
    porcentajeIncremento: 0.75,
    inicioVigencia: '4/1/2018 (09:30:15)',
    finVigencia: '12/31/2019 (09:30:15)',
    estatus: 'Activo',
    vigenciaTasas: 'Del 01/04/2018 al 31/12/2019',
    tipoTasa: 'Fija'
  },
  {
    id: 3,
    tipoProducto: 'Inversión a la Vista',
    empleado: '7',
    minimoEmpleado: 1,
    tasaMinima: 2.50,
    tasaInicial: 12.00,
    tasaMaxima: 0.25,
    porcentajeIncremento: 0.25,
    inicioVigencia: '1/1/2020 (10:00:00)',
    finVigencia: '12/31/2020 (10:00:00)',
    estatus: 'Activo',
    vigenciaTasas: 'Del 01/01/2020 al 31/12/2020',
    tipoTasa: 'Variable'
  },
  {
    id: 4,
    tipoProducto: 'Inversión Premium',
    empleado: '10',
    minimoEmpleado: 5,
    tasaMinima: 5.00,
    tasaInicial: 20.00,
    tasaMaxima: 2.00,
    porcentajeIncremento: 1.00,
    inicioVigencia: '1/1/2021 (08:00:00)',
    finVigencia: '12/31/2021 (08:00:00)',
    estatus: 'Inactivo',
    vigenciaTasas: 'Del 01/01/2021 al 31/12/2021',
    tipoTasa: 'Fija'
  },
  {
    id: 5,
    tipoProducto: 'Inversión Corporativa',
    empleado: '15',
    minimoEmpleado: 10,
    tasaMinima: 6.00,
    tasaInicial: 22.00,
    tasaMaxima: 3.00,
    porcentajeIncremento: 1.50,
    inicioVigencia: '6/1/2021 (14:30:00)',
    finVigencia: '6/30/2022 (14:30:00)',
    estatus: 'Activo',
    vigenciaTasas: 'Del 01/06/2021 al 30/06/2022',
    tipoTasa: 'Variable'
  }
];
