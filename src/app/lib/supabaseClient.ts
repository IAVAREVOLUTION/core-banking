/**
 * Singleton Supabase client — importar desde aquí para evitar
 * múltiples instancias de GoTrueClient en el mismo browser context.
 */
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const SUPABASE_URL = `https://${projectId}.supabase.co`;

export const supabase = createClient(SUPABASE_URL, publicAnonKey);
export { SUPABASE_URL, publicAnonKey };
