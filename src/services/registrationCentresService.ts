/**
 * registrationCentresService.ts
 *
 * Supabase query layer for the iebc_registration_centres table.
 * Matches Nasaka's existing architecture.
 */

import { supabase } from '../integrations/supabase/client';

export interface RegistrationCentre {
  id: string;
  name: string;
  county: string;
  constituency: string;
  ward: string | null;
  centre_code: string | null;
  returning_officer_name: string | null;
  returning_officer_email: string | null;
  scraped_at: string;
}

export interface CentresFilters {
  county?: string;
  constituency?: string;
  ward?: string;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}

export interface CentresResult {
  data: RegistrationCentre[];
  count: number;
  hasMore: boolean;
}

const DEFAULT_PAGE_SIZE = 25;

// ============================================================
// Search centres using PostgreSQL full-text search
// ============================================================
export async function searchRegistrationCentres(
  query: string,
  limit = 50
): Promise<RegistrationCentre[]> {
  const { data, error } = await (supabase as any).rpc('search_registration_centres', {
    query: query, // Use 'query' to match the SQL function parameter
  });

  if (error) {
    console.error('[searchRegistrationCentres]', error.message);
    return [];
  }

  return (data || []).slice(0, limit) as RegistrationCentre[];
}

// ============================================================
// Filtered query (county + constituency + ward + text search)
// ============================================================
export async function getCentresFiltered(filters: CentresFilters): Promise<CentresResult> {
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('iebc_registration_centres')
    .select('*', { count: 'exact' });

  if (filters.county) query = query.ilike('county', filters.county);
  if (filters.constituency) query = query.ilike('constituency', filters.constituency);
  if (filters.ward) query = query.ilike('ward', filters.ward);
  
  if (filters.searchQuery && filters.searchQuery.trim()) {
    query = query.ilike('name', `%${filters.searchQuery.trim()}%`);
  }

  query = query
    .order('county', { ascending: true })
    .order('constituency', { ascending: true })
    .order('name', { ascending: true })
    .range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('[getCentresFiltered]', error.message);
    return { data: [], count: 0, hasMore: false };
  }

  const total = count || 0;
  return {
    data: (data || []) as RegistrationCentre[],
    count: total,
    hasMore: from + pageSize < total,
  };
}

// ============================================================
// Metadata Helpers
// ============================================================

export async function getUniqueCounties(): Promise<string[]> {
  const { data, error } = await supabase
    .from('iebc_registration_centres')
    .select('county')
    .order('county', { ascending: true });
  if (error) return [];
  return [...new Set((data || []).map(r => r.county))] as string[];
}

export async function getConstituenciesForCounty(county: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('iebc_registration_centres')
    .select('constituency')
    .ilike('county', county)
    .order('constituency', { ascending: true });
  if (error) return [];
  return [...new Set((data || []).map(r => r.constituency))] as string[];
}

export async function getWardsForConstituency(constituency: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('iebc_registration_centres')
    .select('ward')
    .ilike('constituency', constituency)
    .not('ward', 'is', null)
    .order('ward', { ascending: true });
  if (error) return [];
  return [...new Set((data || []).map(r => r.ward).filter(Boolean))] as string[];
}

export async function getRegistrationCentresCount(): Promise<number> {
  const { count, error } = await supabase
    .from('iebc_registration_centres')
    .select('*', { count: 'exact', head: true });
  return count || 0;
}
