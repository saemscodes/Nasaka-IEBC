/**
 * RegistrationCentreSearch.tsx
 *
 * Full search UI for IEBC registration/polling centres.
 * Matches Nasaka's iOS glassmorphism design language.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  getCentresFiltered,
  getUniqueCounties,
  getConstituenciesForCounty,
  getWardsForConstituency,
  getRegistrationCentresCount,
  type RegistrationCentre,
  type CentresFilters,
} from '../services/registrationCentresService';

const RegistrationCentreSearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCounty, setSelectedCounty] = useState('');
  const [selectedConst, setSelectedConst] = useState('');
  const [selectedWard, setSelectedWard] = useState('');
  
  const [counties, setCounties] = useState<string[]>([]);
  const [constituencies, setConstituencies] = useState<string[]>([]);
  const [wards, setWards] = useState<string[]>([]);

  const [results, setResults] = useState<RegistrationCentre[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalDB, setTotalDB] = useState(0);
  const [loading, setLoading] = useState(false);

  // Initialize counties
  useEffect(() => {
    getUniqueCounties().then(setCounties);
    getRegistrationCentresCount().then(setTotalDB);
  }, []);

  // Cascade selections
  useEffect(() => {
    if (selectedCounty) getConstituenciesForCounty(selectedCounty).then(setConstituencies);
    else setConstituencies([]);
    setSelectedConst('');
  }, [selectedCounty]);

  useEffect(() => {
    if (selectedConst) getWardsForConstituency(selectedConst).then(setWards);
    else setWards([]);
    setSelectedWard('');
  }, [selectedConst]);

  // Main search logic
  const performSearch = useCallback(async () => {
    setLoading(true);
    const filters: CentresFilters = {
      county: selectedCounty || undefined,
      constituency: selectedConst || undefined,
      ward: selectedWard || undefined,
      searchQuery: searchQuery || undefined,
      page: 0,
      pageSize: 50
    };
    const { data, count } = await getCentresFiltered(filters);
    setResults(data);
    setTotalCount(count);
    setLoading(false);
  }, [selectedCounty, selectedConst, selectedWard, searchQuery]);

  useEffect(() => {
    performSearch();
  }, [performSearch]);

  return (
    <div className="registration-search-root p-6 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Registration Centres</h1>
        <p className="text-muted-foreground">{totalDB.toLocaleString()} centres countrywide</p>
      </header>

      {/* Glassmorphic Filter Card */}
      <div className="filters-card glass p-6 rounded-2xl border border-white/10 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search centres..."
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-green-500/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          
          <select 
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none"
            value={selectedCounty}
            onChange={(e) => setSelectedCounty(e.target.value)}
          >
            <option value="">All Counties</option>
            {counties.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select 
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none"
            value={selectedConst}
            onChange={(e) => setSelectedConst(e.target.value)}
            disabled={!selectedCounty}
          >
            <option value="">All Constituencies</option>
            {constituencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select 
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none"
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
            disabled={!selectedConst}
          >
            <option value="">All Wards</option>
            {wards.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
      </div>

      {/* Results List */}
      <div className="results-grid space-y-3">
        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : results.length > 0 ? (
          results.map(centre => (
            <div key={centre.id} className="centre-card glass p-4 rounded-xl border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center hover:bg-white/5 transition-colors gap-3">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{centre.name}</h3>
                <p className="text-sm opacity-60">{centre.county} • {centre.constituency} {centre.ward ? `• ${centre.ward}` : ''}</p>
                
                {(centre.returning_officer_name || centre.returning_officer_email) && (
                  <div className="mt-2 text-xs flex items-center gap-3 opacity-80">
                    {centre.returning_officer_name && (
                      <span className="flex items-center gap-1">
                        <span className="opacity-50 font-bold">RO:</span> {centre.returning_officer_name}
                      </span>
                    )}
                    {centre.returning_officer_email && (
                      <span className="text-green-500/80 underline cursor-pointer">{centre.returning_officer_email}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="text-xs font-mono opacity-40 bg-white/5 px-2 py-1 rounded-md">{centre.centre_code}</div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 opacity-50">No centres found matching your search.</div>
        )}
      </div>
    </div>
  );
};

export default RegistrationCentreSearch;
