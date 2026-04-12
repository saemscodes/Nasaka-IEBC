import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import {
    Search,
    Filter,
    Map as MapIcon,
    CheckCircle,
    XCircle,
    Archive,
    MoreVertical,
    Maximize2,
    ExternalLink,
    ChevronDown,
    ChevronUp,
    Info,
    Clock,
    Smartphone,
    Camera,
    Navigation,
    Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const contributionIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const existingOfficeIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const FitBounds = ({ lat, lng }: { lat: number; lng: number }) => {
    const map = useMap();
    useEffect(() => {
        map.setView([lat, lng], 15);
    }, [lat, lng, map]);
    return null;
};

const ModerationPanel = () => {
    const [contributions, setContributions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('pending_review');
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [isActionLoading, setIsActionLoading] = useState<number | null>(null);
    const [existingOffice, setExistingOffice] = useState<any>(null);
    const [detailsExpanded, setDetailsExpanded] = useState(false);

    const fetchContributions = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('iebc_office_contributions')
                .select('*')
                .order('created_at', { ascending: false });

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            const { data, error } = await query;
            if (error) throw error;
            setContributions(data || []);
        } catch (err) {
            toast.error('Failed to fetch contributions');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchContributions();
    }, [fetchContributions]);

    useEffect(() => {
        if (selectedItem?.original_office_id) {
            supabase
                .from('iebc_offices')
                .select('id,constituency_name,county,office_location,latitude,longitude')
                .eq('id', selectedItem.original_office_id)
                .single()
                .then(({ data }) => setExistingOffice(data || null));
        } else {
            setExistingOffice(null);
        }
    }, [selectedItem]);

    const handleAction = async (id: number, action: string) => {
        setIsActionLoading(id);
        try {
            let result;
            if (action === 'verify') {
                result = await (supabase as any).rpc('moderate_contribution', {
                    p_contribution_id: id,
                    p_admin_id: 'admin',
                    p_office_data: {}
                });
            } else if (action === 'reject' || action === 'archive') {
                result = await (supabase as any).from('iebc_office_contributions').update({
                    status: action === 'reject' ? 'rejected' : 'archived',
                    updated_at: new Date().toISOString()
                }).eq('id', id);
            }

            if (result.error) throw result.error;

            toast.success(`Entry ${action === 'verify' ? 'verified' : action === 'reject' ? 'rejected' : 'archived'} successfully`);
            fetchContributions();
            setSelectedItem(null);
        } catch (err: any) {
            toast.error(`Action failed: ${err.message}`);
        } finally {
            setIsActionLoading(null);
        }
    };

    const filteredItems = contributions.filter(item =>
        item.submitted_office_location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.submitted_county?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.submitted_constituency?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const parseJsonField = (field: any) => {
        if (!field) return null;
        if (typeof field === 'object') return field;
        try { return JSON.parse(field); } catch { return null; }
    };

    return (
        <div className="space-y-6">
            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.02] border border-white/10 rounded-3xl p-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search by location, county, or constituency..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    />
                </div>

                <div className="flex items-center space-x-3">
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl p-1">
                        {['pending_review', 'verified', 'rejected', 'archived', 'all'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${statusFilter === status
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                {status.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                    <button className="p-3 bg-white/5 border border-white/10 rounded-2xl text-gray-400 hover:text-white transition-all">
                        <Filter size={18} />
                    </button>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* List Side */}
                <div className="xl:col-span-2 space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 custom-scrollbar">
                    {loading ? (
                        Array(5).fill(0).map((_, i) => (
                            <div key={i} className="h-32 bg-white/5 rounded-3xl animate-pulse border border-white/5" />
                        ))
                    ) : filteredItems.length > 0 ? (
                        filteredItems.map((item) => (
                            <motion.div
                                layout
                                key={item.id}
                                onClick={() => setSelectedItem(item)}
                                className={`p-6 rounded-3xl border transition-all cursor-pointer group ${selectedItem?.id === item.id
                                    ? 'bg-blue-600/10 border-blue-500/40 shadow-2xl'
                                    : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                                    }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <div className="flex items-center space-x-3">
                                            <h4 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                                                {item.submitted_office_location || 'Unnamed Location'}
                                            </h4>
                                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${item.status === 'pending_review' ? 'bg-amber-500/20 text-amber-400' :
                                                item.status === 'verified' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    'bg-red-500/20 text-red-400'
                                                }`}>
                                                {item.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-400">
                                            {item.submitted_county} • {item.submitted_constituency}
                                        </p>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        {item.image_public_url && (
                                            <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10">
                                                <img src={item.image_public_url} alt="Submission" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                        <button className="p-2 text-gray-500 hover:text-white transition-colors">
                                            <MoreVertical size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 flex items-center justify-between">
                                    <div className="flex items-center space-x-4 text-xs text-gray-500 font-medium">
                                        <div className="flex items-center space-x-1">
                                            <MapIcon size={12} />
                                            <span>{item.submitted_latitude?.toFixed(4)}, {item.submitted_longitude?.toFixed(4)}</span>
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <Clock size={12} />
                                            <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    {item.status === 'pending_review' && (
                                        <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleAction(item.id, 'verify'); }}
                                                className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/30 transition-all"
                                            >
                                                <CheckCircle size={18} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleAction(item.id, 'reject'); }}
                                                className="p-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-all"
                                            >
                                                <XCircle size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="text-center py-20 bg-white/[0.02] border border-dashed border-white/10 rounded-[2.5rem]">
                            <Info className="mx-auto text-gray-600 mb-4" size={48} />
                            <h3 className="text-xl font-bold text-gray-400">No matching contributions</h3>
                            <p className="text-sm text-gray-500">Try adjusting your filters or search query</p>
                        </div>
                    )}
                </div>

                {/* Detail/Preview Side */}
                <div className="hidden xl:block">
                    <AnimatePresence mode="wait">
                        {selectedItem ? (
                            <motion.div
                                key={selectedItem.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="bg-white/[0.04] border border-white/10 rounded-[2.5rem] p-8 space-y-6 sticky top-0 max-h-[calc(100vh-180px)] overflow-y-auto custom-scrollbar"
                            >
                                <div className="flex border-b border-white/5 pb-6 justify-between items-center">
                                    <h3 className="text-xl font-bold text-white">Entry Details</h3>
                                    <button onClick={() => setSelectedItem(null)} className="text-gray-500 hover:text-white transition-colors">
                                        <Maximize2 size={18} />
                                    </button>
                                </div>

                                {/* MAP VIEW */}
                                <div className="w-full h-[220px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                                    <MapContainer
                                        center={[selectedItem.submitted_latitude, selectedItem.submitted_longitude]}
                                        zoom={15}
                                        style={{ height: '100%', width: '100%' }}
                                        scrollWheelZoom={false}
                                        zoomControl={false}
                                    >
                                        <TileLayer
                                            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                                            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                                        />
                                        <FitBounds lat={selectedItem.submitted_latitude} lng={selectedItem.submitted_longitude} />
                                        <Marker position={[selectedItem.submitted_latitude, selectedItem.submitted_longitude]} icon={contributionIcon}>
                                            <Popup>
                                                <strong>Contributed Pin</strong><br />
                                                {selectedItem.submitted_office_location}
                                            </Popup>
                                        </Marker>
                                        {existingOffice && existingOffice.latitude && (
                                            <Marker position={[existingOffice.latitude, existingOffice.longitude]} icon={existingOfficeIcon}>
                                                <Popup>
                                                    <strong>Existing IEBC Office</strong><br />
                                                    {existingOffice.office_location}
                                                </Popup>
                                            </Marker>
                                        )}
                                    </MapContainer>
                                </div>
                                <div className="flex items-center space-x-4 text-[10px] text-gray-500 font-mono">
                                    <div className="flex items-center space-x-1"><div className="w-2 h-2 rounded-full bg-blue-500" /><span>Contributed</span></div>
                                    {existingOffice && <div className="flex items-center space-x-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span>Existing Office</span></div>}
                                </div>

                                {selectedItem.image_public_url && (
                                    <div className="aspect-video w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl group relative">
                                        <img src={selectedItem.image_public_url} alt="Full Resolution" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                                            <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">Ground Truth Photo</p>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Office Name & Location</p>
                                        <p className="text-white font-medium">{selectedItem.submitted_office_location}</p>
                                        <p className="text-xs text-gray-400">{selectedItem.submitted_county}, {selectedItem.submitted_constituency}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1">Accuracy</p>
                                            <p className="text-lg font-bold text-white">±{Math.round(selectedItem.submitted_accuracy_meters || 0)}m</p>
                                        </div>
                                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1">Confidence</p>
                                            <p className="text-lg font-bold text-blue-400">{selectedItem.confidence_score || 0}%</p>
                                        </div>
                                    </div>

                                    {selectedItem.submitted_landmark && (
                                        <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4">
                                            <p className="text-[10px] font-black uppercase text-amber-400 tracking-widest mb-1">Landmark Intel</p>
                                            <p className="text-sm text-gray-300 leading-relaxed">{selectedItem.submitted_landmark}</p>
                                        </div>
                                    )}
                                </div>

                                {/* EXPANDABLE SUBMISSION DETAILS */}
                                <div className="border border-white/5 rounded-2xl overflow-hidden">
                                    <button
                                        onClick={() => setDetailsExpanded(!detailsExpanded)}
                                        className="w-full flex items-center justify-between p-4 bg-white/[0.03] hover:bg-white/[0.05] transition-all"
                                    >
                                        <div className="flex items-center space-x-2 text-sm font-bold text-gray-300">
                                            <Layers size={14} />
                                            <span>Submission Details</span>
                                        </div>
                                        {detailsExpanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                                    </button>
                                    <AnimatePresence>
                                        {detailsExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="p-4 space-y-3 text-xs">
                                                    <div className="flex items-start space-x-2">
                                                        <Navigation size={12} className="text-gray-500 mt-0.5 flex-shrink-0" />
                                                        <div>
                                                            <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Coordinates</p>
                                                            <p className="text-gray-300 font-mono">{selectedItem.submitted_latitude?.toFixed(6)}, {selectedItem.submitted_longitude?.toFixed(6)}</p>
                                                        </div>
                                                    </div>

                                                    {selectedItem.submission_source && (
                                                        <div className="flex items-start space-x-2">
                                                            <Info size={12} className="text-gray-500 mt-0.5 flex-shrink-0" />
                                                            <div>
                                                                <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Submission Source</p>
                                                                <p className="text-gray-300">{selectedItem.submission_source}</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {selectedItem.submission_method && (
                                                        <div className="flex items-start space-x-2">
                                                            <Info size={12} className="text-gray-500 mt-0.5 flex-shrink-0" />
                                                            <div>
                                                                <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Capture Method</p>
                                                                <p className="text-gray-300">{selectedItem.submission_method}</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {(() => {
                                                        const dm = parseJsonField(selectedItem.device_metadata);
                                                        if (!dm) return null;
                                                        return (
                                                            <div className="flex items-start space-x-2">
                                                                <Smartphone size={12} className="text-gray-500 mt-0.5 flex-shrink-0" />
                                                                <div>
                                                                    <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Device Info</p>
                                                                    <p className="text-gray-300">{dm.platform || 'Unknown'} • {dm.language || ''}</p>
                                                                    {dm.screen_resolution && <p className="text-gray-500">{dm.screen_resolution}</p>}
                                                                    {dm.capture_source && <p className="text-gray-500">Source: {dm.capture_source}</p>}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {(() => {
                                                        const exif = parseJsonField(selectedItem.exif_metadata);
                                                        if (!exif) return null;
                                                        return (
                                                            <div className="flex items-start space-x-2">
                                                                <Camera size={12} className="text-gray-500 mt-0.5 flex-shrink-0" />
                                                                <div>
                                                                    <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Image Metadata</p>
                                                                    {exif.file_name && <p className="text-gray-300">{exif.file_name}</p>}
                                                                    {exif.file_type && <p className="text-gray-500">{exif.file_type} • {exif.file_size ? `${(exif.file_size / 1024).toFixed(1)}KB` : ''}</p>}
                                                                    <p className="text-gray-500">EXIF: {exif.has_exif ? 'Present' : 'Not detected'}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {(() => {
                                                        const rgr = parseJsonField(selectedItem.reverse_geocode_result);
                                                        if (!rgr) return null;
                                                        return (
                                                            <div className="flex items-start space-x-2">
                                                                <MapIcon size={12} className="text-gray-500 mt-0.5 flex-shrink-0" />
                                                                <div>
                                                                    <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Reverse Geocode</p>
                                                                    {rgr.display_name && <p className="text-gray-300 leading-relaxed">{rgr.display_name}</p>}
                                                                    {rgr.county && <p className="text-gray-500">County: {rgr.county}</p>}
                                                                    {rgr.road && <p className="text-gray-500">Road: {rgr.road}</p>}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {selectedItem.nearby_landmarks && Array.isArray(selectedItem.nearby_landmarks) && selectedItem.nearby_landmarks.length > 0 && (
                                                        <div className="flex items-start space-x-2">
                                                            <Layers size={12} className="text-gray-500 mt-0.5 flex-shrink-0" />
                                                            <div>
                                                                <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Nearby Landmarks</p>
                                                                {selectedItem.nearby_landmarks.map((lm: any, i: number) => (
                                                                    <p key={i} className="text-gray-300">{typeof lm === 'string' ? lm : lm.name || JSON.stringify(lm)}</p>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="flex items-start space-x-2">
                                                        <Clock size={12} className="text-gray-500 mt-0.5 flex-shrink-0" />
                                                        <div>
                                                            <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Submitted</p>
                                                            <p className="text-gray-300">{new Date(selectedItem.created_at).toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <div className="flex gap-3 pt-6 border-t border-white/5">
                                    <button
                                        onClick={() => handleAction(selectedItem.id, 'verify')}
                                        disabled={selectedItem.status !== 'pending_review' || isActionLoading === selectedItem.id}
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2"
                                    >
                                        {isActionLoading === selectedItem.id ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <><CheckCircle size={18} /><span>Approve</span></>}
                                    </button>
                                    <button
                                        onClick={() => handleAction(selectedItem.id, 'reject')}
                                        disabled={selectedItem.status !== 'pending_review' || isActionLoading === selectedItem.id}
                                        className="p-3 bg-red-600/20 text-red-400 border border-red-500/20 rounded-2xl hover:bg-red-600/30 transition-all flex items-center justify-center"
                                    >
                                        <XCircle size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleAction(selectedItem.id, 'archive')}
                                        disabled={selectedItem.status !== 'pending_review' || isActionLoading === selectedItem.id}
                                        className="p-3 bg-white/5 border border-white/10 rounded-2xl text-gray-400 hover:text-white transition-all flex items-center justify-center disabled:opacity-50"
                                    >
                                        <Archive size={18} />
                                    </button>
                                </div>

                                {selectedItem.google_maps_link && (
                                    <a
                                        href={selectedItem.google_maps_link}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center justify-center space-x-2 text-xs text-gray-500 hover:text-blue-400 transition-colors pt-2"
                                    >
                                        <span>Inspect external mapping context</span>
                                        <ExternalLink size={12} />
                                    </a>
                                )}
                            </motion.div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center bg-white/[0.02] border border-dashed border-white/10 rounded-[2.5rem] p-8 text-center">
                                <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mb-4">
                                    <Info className="text-gray-600" size={32} />
                                </div>
                                <h4 className="text-lg font-bold text-gray-400">No Item Selected</h4>
                                <p className="text-sm text-gray-500 max-w-xs">Select a contribution from the list to view granular detail and mapping context.</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default ModerationPanel;
