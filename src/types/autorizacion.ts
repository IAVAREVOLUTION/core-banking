// Tipo para Autorización basado en K_FINCORP_ACCOUNT_AUTHORIZATIONS
export interface Autorizacion {
  id: number;
  fincorpAccountId: number;
  authUserId: number;
  authUserName?: string;
  authDate: string;
  authStatus: string;
  area?: string;
  description?: string;
  notes?: string;
  authorizedAmount?: number;
  authorizedTerm?: number;
  authorizedRate?: number;
}
