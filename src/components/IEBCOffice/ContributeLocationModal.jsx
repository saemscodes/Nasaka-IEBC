// src/components/IEBCOffice/ContributeLocationModal.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Check, AlertTriangle, Info, Camera, MapPin, Search, Globe, ChevronLeft, ChevronRight, X, AlertCircle } from 'lucide-react';
import { useContributeLocation } from '@/hooks/useContributeLocation';
import MapContainer from '@/components/IEBCOffice/MapContainer';
import UserLocationMarker from '@/components/IEBCOffice/UserLocationMarker';
import GeoJSONLayerManager from '@/components/IEBCOffice/GeoJSONLayerManager';
import LoadingSpinner from './LoadingSpinner';
import { supabase } from '@/integrations/supabase/client';
import L from 'leaflet';

// Comprehensive Kenyan counties data from database
const COUNTIES_DATA = [
  { id: 1, name: 'Baringo', county_code: '030' },
  { id: 2, name: 'Bomet', county_code: '036' },
  { id: 3, name: 'Bungoma', county_code: '039' },
  { id: 4, name: 'Busia', county_code: '040' },
  { id: 5, name: 'Elgeyo/Marakwet', county_code: '028' },
  { id: 6, name: 'Embu', county_code: '014' },
  { id: 7, name: 'Garissa', county_code: '007' },
  { id: 8, name: 'Homa Bay', county_code: '043' },
  { id: 9, name: 'Isiolo', county_code: '011' },
  { id: 10, name: 'Kajiado', county_code: '034' },
  { id: 11, name: 'Kakamega', county_code: '037' },
  { id: 12, name: 'Kericho', county_code: '035' },
  { id: 13, name: 'Kiambu', county_code: '022' },
  { id: 14, name: 'Kilifi', county_code: '003' },
  { id: 15, name: 'Kirinyaga', county_code: '020' },
  { id: 16, name: 'Kisii', county_code: '045' },
  { id: 17, name: 'Kisumu', county_code: '042' },
  { id: 18, name: 'Kitui', county_code: '015' },
  { id: 19, name: 'Kwale', county_code: '002' },
  { id: 20, name: 'Laikipia', county_code: '031' },
  { id: 21, name: 'Lamu', county_code: '005' },
  { id: 22, name: 'Machakos', county_code: '016' },
  { id: 23, name: 'Makueni', county_code: '017' },
  { id: 24, name: 'Mandera', county_code: '009' },
  { id: 25, name: 'Marsabit', county_code: '010' },
  { id: 26, name: 'Meru', county_code: '012' },
  { id: 27, name: 'Migori', county_code: '044' },
  { id: 28, name: 'Mombasa', county_code: '001' },
  { id: 29, name: 'Murang\'a', county_code: '021' },
  { id: 30, name: 'Nairobi', county_code: '047' },
  { id: 31, name: 'Nakuru', county_code: '032' },
  { id: 32, name: 'Nandi', county_code: '029' },
  { id: 33, name: 'Narok', county_code: '033' },
  { id: 34, name: 'Nyamira', county_code: '046' },
  { id: 35, name: 'Nyandarua', county_code: '018' },
  { id: 36, name: 'Nyeri', county_code: '019' },
  { id: 37, name: 'Samburu', county_code: '025' },
  { id: 38, name: 'Siaya', county_code: '041' },
  { id: 39, name: 'Taita Taveta', county_code: '006' },
  { id: 40, name: 'Tana River', county_code: '004' },
  { id: 41, name: 'Tharaka-Nithi', county_code: '013' },
  { id: 42, name: 'Trans Nzoia', county_code: '026' },
  { id: 43, name: 'Turkana', county_code: '023' },
  { id: 44, name: 'Uasin Gishu', county_code: '027' },
  { id: 45, name: 'Vihiga', county_code: '038' },
  { id: 46, name: 'Wajir', county_code: '008' },
  { id: 47, name: 'West Pokot', county_code: '024' }
];

// Comprehensive constituencies data from database
const CONSTITUENCIES_DATA = [
  { id: 1, name: 'CHANGAMWE', county_id: 28 },
  { id: 2, name: 'JOMVU', county_id: 28 },
  { id: 3, name: 'KISAUNI', county_id: 28 },
  { id: 4, name: 'NYALI', county_id: 28 },
  { id: 5, name: 'LIKONI', county_id: 28 },
  { id: 6, name: 'MVITA', county_id: 28 },
  { id: 7, name: 'MSAMBWENI', county_id: 19 },
  { id: 8, name: 'LUNGALUNGA', county_id: 19 },
  { id: 9, name: 'MATUGA', county_id: 19 },
  { id: 10, name: 'KINANGO', county_id: 19 },
  { id: 11, name: 'KILIFI NORTH', county_id: 14 },
  { id: 12, name: 'KILIFI SOUTH', county_id: 14 },
  { id: 13, name: 'KALOLENI', county_id: 14 },
  { id: 14, name: 'RABAI', county_id: 14 },
  { id: 15, name: 'GANZE', county_id: 14 },
  { id: 16, name: 'MALINDI', county_id: 14 },
  { id: 17, name: 'MAGARINI', county_id: 14 },
  { id: 18, name: 'GARSEN', county_id: 40 },
  { id: 19, name: 'GALOLE', county_id: 40 },
  { id: 20, name: 'BURA', county_id: 40 },
  { id: 21, name: 'LAMU EAST', county_id: 21 },
  { id: 22, name: 'LAMU WEST', county_id: 21 },
  { id: 23, name: 'TAVETA', county_id: 39 },
  { id: 24, name: 'WUNDANYI', county_id: 39 },
  { id: 25, name: 'MWATATE', county_id: 39 },
  { id: 26, name: 'VOI', county_id: 39 },
  { id: 27, name: 'GARISSA TOWNSHIP', county_id: 7 },
  { id: 28, name: 'BALAMBALA', county_id: 7 },
  { id: 29, name: 'LAGDERA', county_id: 7 },
  { id: 30, name: 'DADAAB', county_id: 7 },
  { id: 31, name: 'FAFI', county_id: 7 },
  { id: 32, name: 'IJARA', county_id: 7 },
  { id: 33, name: 'WAJIR NORTH', county_id: 46 },
  { id: 34, name: 'WAJIR EAST', county_id: 46 },
  { id: 35, name: 'TARBAJ', county_id: 46 },
  { id: 36, name: 'WAJIR WEST', county_id: 46 },
  { id: 37, name: 'ELDAS', county_id: 46 },
  { id: 38, name: 'WAJIR SOUTH', county_id: 46 },
  { id: 39, name: 'MANDERA WEST', county_id: 24 },
  { id: 40, name: 'BANISSA', county_id: 24 },
  { id: 41, name: 'MANDERA NORTH', county_id: 24 },
  { id: 42, name: 'MANDERA SOUTH', county_id: 24 },
  { id: 43, name: 'MANDERA EAST', county_id: 24 },
  { id: 44, name: 'LAFEY', county_id: 24 },
  { id: 45, name: 'MOYALE', county_id: 25 },
  { id: 46, name: 'NORTH HORR', county_id: 25 },
  { id: 47, name: 'SAKU', county_id: 25 },
  { id: 48, name: 'LAISAMIS', county_id: 25 },
  { id: 49, name: 'ISIOLO NORTH', county_id: 9 },
  { id: 50, name: 'ISIOLO SOUTH', county_id: 9 },
  { id: 51, name: 'IGEMBE SOUTH', county_id: 26 },
  { id: 52, name: 'IGEMBE CENTRAL', county_id: 26 },
  { id: 53, name: 'IGEMBE NORTH', county_id: 26 },
  { id: 54, name: 'TIGANIA WEST', county_id: 26 },
  { id: 55, name: 'TIGANIA EAST', county_id: 26 },
  { id: 56, name: 'NORTH IMENTI', county_id: 26 },
  { id: 57, name: 'BUURI', county_id: 26 },
  { id: 58, name: 'CENTRAL IMENTI', county_id: 26 },
  { id: 59, name: 'SOUTH IMENTI', county_id: 26 },
  { id: 60, name: 'MAARA', county_id: 41 },
  { id: 61, name: 'CHUKA/IGAMBANG\'OMBE', county_id: 41 },
  { id: 62, name: 'THARAKA', county_id: 41 },
  { id: 63, name: 'MANYATTA', county_id: 6 },
  { id: 64, name: 'RUNYENJES', county_id: 6 },
  { id: 65, name: 'MBEERE SOUTH', county_id: 6 },
  { id: 66, name: 'MBEERE NORTH', county_id: 6 },
  { id: 67, name: 'MWINGI NORTH', county_id: 18 },
  { id: 68, name: 'MWINGI WEST', county_id: 18 },
  { id: 69, name: 'MWINGI CENTRAL', county_id: 18 },
  { id: 70, name: 'KITUI WEST', county_id: 18 },
  { id: 71, name: 'KITUI RURAL', county_id: 18 },
  { id: 72, name: 'KITUI CENTRAL', county_id: 18 },
  { id: 73, name: 'KITUI EAST', county_id: 18 },
  { id: 74, name: 'KITUI SOUTH', county_id: 18 },
  { id: 75, name: 'MASINGA', county_id: 22 },
  { id: 76, name: 'YATTA', county_id: 22 },
  { id: 77, name: 'KANGUNDO', county_id: 22 },
  { id: 78, name: 'MATUNGULU', county_id: 22 },
  { id: 79, name: 'KATHIANI', county_id: 22 },
  { id: 80, name: 'MAVOKO', county_id: 22 },
  { id: 81, name: 'MACHAKOS TOWN', county_id: 22 },
  { id: 82, name: 'MWALA', county_id: 22 },
  { id: 83, name: 'MBOONI', county_id: 23 },
  { id: 84, name: 'KILOME', county_id: 23 },
  { id: 85, name: 'KAITI', county_id: 23 },
  { id: 86, name: 'MAKUENI', county_id: 23 },
  { id: 87, name: 'KIBWEZI WEST', county_id: 23 },
  { id: 88, name: 'KIBWEZI EAST', county_id: 23 },
  { id: 89, name: 'KINANGOP', county_id: 35 },
  { id: 90, name: 'KIPIPIRI', county_id: 35 },
  { id: 91, name: 'OL KALOU', county_id: 35 },
  { id: 92, name: 'OL JOROK', county_id: 35 },
  { id: 93, name: 'NDARAGWA', county_id: 35 },
  { id: 94, name: 'TETU', county_id: 36 },
  { id: 95, name: 'KIENI', county_id: 36 },
  { id: 96, name: 'MATHIRA', county_id: 36 },
  { id: 97, name: 'OTHAYA', county_id: 36 },
  { id: 98, name: 'MUKURWEINI', county_id: 36 },
  { id: 99, name: 'NYERI TOWN', county_id: 36 },
  { id: 100, name: 'MWEA', county_id: 15 },
  { id: 101, name: 'GICHUGU', county_id: 15 },
  { id: 102, name: 'NDIA', county_id: 15 },
  { id: 103, name: 'KIRINYAGA CENTRAL', county_id: 15 },
  { id: 104, name: 'KANGEMA', county_id: 29 },
  { id: 105, name: 'MATHIOYA', county_id: 29 },
  { id: 106, name: 'KIHARU', county_id: 29 },
  { id: 107, name: 'KIGUMO', county_id: 29 },
  { id: 108, name: 'MARAGWA', county_id: 29 },
  { id: 109, name: 'KANDARA', county_id: 29 },
  { id: 110, name: 'GATANGA', county_id: 29 },
  { id: 111, name: 'GATUNDU SOUTH', county_id: 13 },
  { id: 112, name: 'GATUNDU NORTH', county_id: 13 },
  { id: 113, name: 'JUJA', county_id: 13 },
  { id: 114, name: 'THIKA TOWN', county_id: 13 },
  { id: 115, name: 'RUIRU', county_id: 13 },
  { id: 116, name: 'GITHUNGURI', county_id: 13 },
  { id: 117, name: 'KIAMBU', county_id: 13 },
  { id: 118, name: 'KIAMBAA', county_id: 13 },
  { id: 119, name: 'KABETE', county_id: 13 },
  { id: 120, name: 'KIKUYU', county_id: 13 },
  { id: 121, name: 'LIMURU', county_id: 13 },
  { id: 122, name: 'LARI', county_id: 13 },
  { id: 123, name: 'TURKANA NORTH', county_id: 43 },
  { id: 124, name: 'TURKANA WEST', county_id: 43 },
  { id: 125, name: 'TURKANA CENTRAL', county_id: 43 },
  { id: 126, name: 'LOIMA', county_id: 43 },
  { id: 127, name: 'TURKANA SOUTH', county_id: 43 },
  { id: 128, name: 'TURKANA EAST', county_id: 43 },
  { id: 129, name: 'KAPENGURIA', county_id: 47 },
  { id: 130, name: 'SIGOR', county_id: 47 },
  { id: 131, name: 'KACHELIBA', county_id: 47 },
  { id: 132, name: 'POKOT SOUTH', county_id: 47 },
  { id: 133, name: 'SAMBURU WEST', county_id: 37 },
  { id: 134, name: 'SAMBURU NORTH', county_id: 37 },
  { id: 135, name: 'SAMBURU EAST', county_id: 37 },
  { id: 136, name: 'KWANZA', county_id: 42 },
  { id: 137, name: 'ENDEBESS', county_id: 42 },
  { id: 138, name: 'SABOTI', county_id: 42 },
  { id: 139, name: 'KIMININI', county_id: 42 },
  { id: 140, name: 'CHERANGANY', county_id: 42 },
  { id: 141, name: 'SOY', county_id: 44 },
  { id: 142, name: 'TURBO', county_id: 44 },
  { id: 143, name: 'MOIBEN', county_id: 44 },
  { id: 144, name: 'AINABKOI', county_id: 44 },
  { id: 145, name: 'KAPSERET', county_id: 44 },
  { id: 146, name: 'KESSES', county_id: 44 },
  { id: 147, name: 'MARAKWET EAST', county_id: 5 },
  { id: 148, name: 'MARAKWET WEST', county_id: 5 },
  { id: 149, name: 'KEIYO NORTH', county_id: 5 },
  { id: 150, name: 'KEIYO SOUTH', county_id: 5 },
  { id: 151, name: 'TINDERET', county_id: 32 },
  { id: 152, name: 'ALDAI', county_id: 32 },
  { id: 153, name: 'NANDI HILLS', county_id: 32 },
  { id: 154, name: 'CHESUMEI', county_id: 32 },
  { id: 155, name: 'EMGWEN', county_id: 32 },
  { id: 156, name: 'MOSOP', county_id: 32 },
  { id: 157, name: 'TIATY', county_id: 1 },
  { id: 158, name: 'BARINGO NORTH', county_id: 1 },
  { id: 159, name: 'BARINGO CENTRAL', county_id: 1 },
  { id: 160, name: 'BARINGO SOUTH', county_id: 1 },
  { id: 161, name: 'MOGOTIO', county_id: 1 },
  { id: 162, name: 'ELDAMA RAVINE', county_id: 1 },
  { id: 163, name: 'LAIKIPIA WEST', county_id: 20 },
  { id: 164, name: 'LAIKIPIA EAST', county_id: 20 },
  { id: 165, name: 'LAIKIPIA NORTH', county_id: 20 },
  { id: 166, name: 'MOLO', county_id: 31 },
  { id: 167, name: 'NJORO', county_id: 31 },
  { id: 168, name: 'NAIVASHA', county_id: 31 },
  { id: 169, name: 'GILGIL', county_id: 31 },
  { id: 170, name: 'KURESOI SOUTH', county_id: 31 },
  { id: 171, name: 'KURESOI NORTH', county_id: 31 },
  { id: 172, name: 'SUBUKIA', county_id: 31 },
  { id: 173, name: 'RONGAI', county_id: 31 },
  { id: 174, name: 'BAHATI', county_id: 31 },
  { id: 175, name: 'NAKURU TOWN WEST', county_id: 31 },
  { id: 176, name: 'NAKURU TOWN EAST', county_id: 31 },
  { id: 177, name: 'KILGORIS', county_id: 33 },
  { id: 178, name: 'EMURUA DIKIRR', county_id: 33 },
  { id: 179, name: 'NAROK NORTH', county_id: 33 },
  { id: 180, name: 'NAROK EAST', county_id: 33 },
  { id: 181, name: 'NAROK SOUTH', county_id: 33 },
  { id: 182, name: 'NAROK WEST', county_id: 33 },
  { id: 183, name: 'KAJIADO NORTH', county_id: 10 },
  { id: 184, name: 'KAJIADO CENTRAL', county_id: 10 },
  { id: 185, name: 'KAJIADO EAST', county_id: 10 },
  { id: 186, name: 'KAJIADO WEST', county_id: 10 },
  { id: 187, name: 'KAJIADO SOUTH', county_id: 10 },
  { id: 188, name: 'KIPKELION EAST', county_id: 12 },
  { id: 189, name: 'KIPKELION WEST', county_id: 12 },
  { id: 190, name: 'AINAMOI', county_id: 12 },
  { id: 191, name: 'BURETI', county_id: 12 },
  { id: 192, name: 'BELGUT', county_id: 12 },
  { id: 193, name: 'SIGOWET/SOIN', county_id: 12 },
  { id: 194, name: 'SOTIK', county_id: 2 },
  { id: 195, name: 'CHEPALUNGU', county_id: 2 },
  { id: 196, name: 'BOMET EAST', county_id: 2 },
  { id: 197, name: 'BOMET CENTRAL', county_id: 2 },
  { id: 198, name: 'KONOIN', county_id: 2 },
  { id: 199, name: 'LUGARI', county_id: 11 },
  { id: 200, name: 'LIKUYANI', county_id: 11 },
  { id: 201, name: 'MALAVA', county_id: 11 },
  { id: 202, name: 'LURAMBI', county_id: 11 },
  { id: 203, name: 'NAVAKHOLO', county_id: 11 },
  { id: 204, name: 'MUMIAS WEST', county_id: 11 },
  { id: 205, name: 'MUMIAS EAST', county_id: 11 },
  { id: 206, name: 'MATUNGU', county_id: 11 },
  { id: 207, name: 'BUTERE', county_id: 11 },
  { id: 208, name: 'KHWISERO', county_id: 11 },
  { id: 209, name: 'SHINYALU', county_id: 11 },
  { id: 210, name: 'IKOLOMANI', county_id: 11 },
  { id: 211, name: 'VIHIGA', county_id: 45 },
  { id: 212, name: 'SABATIA', county_id: 45 },
  { id: 213, name: 'HAMISI', county_id: 45 },
  { id: 214, name: 'LUANDA', county_id: 45 },
  { id: 215, name: 'EMUHAYA', county_id: 45 },
  { id: 216, name: 'MT. ELGON', county_id: 3 },
  { id: 217, name: 'SIRISIA', county_id: 3 },
  { id: 218, name: 'KABUCHAI', county_id: 3 },
  { id: 219, name: 'BUMULA', county_id: 3 },
  { id: 220, name: 'KANDUYI', county_id: 3 },
  { id: 221, name: 'WEBUYE EAST', county_id: 3 },
  { id: 222, name: 'WEBUYE WEST', county_id: 3 },
  { id: 223, name: 'KIMILILI', county_id: 3 },
  { id: 224, name: 'TONGAREN', county_id: 3 },
  { id: 225, name: 'TESO NORTH', county_id: 4 },
  { id: 226, name: 'TESO SOUTH', county_id: 4 },
  { id: 227, name: 'NAMBALE', county_id: 4 },
  { id: 228, name: 'MATAYOS', county_id: 4 },
  { id: 229, name: 'BUTULA', county_id: 4 },
  { id: 230, name: 'FUNYULA', county_id: 4 },
  { id: 231, name: 'BUDALANGI', county_id: 4 },
  { id: 232, name: 'UGENYA', county_id: 38 },
  { id: 233, name: 'UGUNJA', county_id: 38 },
  { id: 234, name: 'ALEGO USONGA', county_id: 38 },
  { id: 235, name: 'GEM', county_id: 38 },
  { id: 236, name: 'BONDO', county_id: 38 },
  { id: 237, name: 'RARIEDA', county_id: 38 },
  { id: 238, name: 'KISUMU EAST', county_id: 17 },
  { id: 239, name: 'KISUMU WEST', county_id: 17 },
  { id: 240, name: 'KISUMU CENTRAL', county_id: 17 },
  { id: 241, name: 'SEME', county_id: 17 },
  { id: 242, name: 'NYANDO', county_id: 17 },
  { id: 243, name: 'MUHORONI', county_id: 17 },
  { id: 244, name: 'NYAKACH', county_id: 17 },
  { id: 245, name: 'KASIPUL', county_id: 8 },
  { id: 246, name: 'KABONDO KASIPUL', county_id: 8 },
  { id: 247, name: 'KARACHUONYO', county_id: 8 },
  { id: 248, name: 'RANGWE', county_id: 8 },
  { id: 249, name: 'HOMA BAY TOWN', county_id: 8 },
  { id: 250, name: 'NDHIWA', county_id: 8 },
  { id: 251, name: 'SUBA NORTH', county_id: 8 },
  { id: 252, name: 'SUBA SOUTH', county_id: 8 },
  { id: 253, name: 'RONGO', county_id: 27 },
  { id: 254, name: 'AWENDO', county_id: 27 },
  { id: 255, name: 'SUNA EAST', county_id: 27 },
  { id: 256, name: 'SUNA WEST', county_id: 27 },
  { id: 257, name: 'URIRI', county_id: 27 },
  { id: 258, name: 'NYATIKE', county_id: 27 },
  { id: 259, name: 'KURIA WEST', county_id: 27 },
  { id: 260, name: 'KURIA EAST', county_id: 27 },
  { id: 261, name: 'BONCHARI', county_id: 16 },
  { id: 262, name: 'SOUTH MUGIRANGO', county_id: 16 },
  { id: 263, name: 'BOMACHOGE BORABU', county_id: 16 },
  { id: 264, name: 'BOBASI', county_id: 16 },
  { id: 265, name: 'BOMACHOGE CHACHE', county_id: 16 },
  { id: 266, name: 'NYARIBARI MASABA', county_id: 16 },
  { id: 267, name: 'NYARIBARI CHACHE', county_id: 16 },
  { id: 268, name: 'KITUTU CHACHE NORTH', county_id: 16 },
  { id: 269, name: 'KITUTU CHACHE SOUTH', county_id: 16 },
  { id: 270, name: 'KITUTU MASABA', county_id: 34 },
  { id: 271, name: 'WEST MUGIRANGO', county_id: 34 },
  { id: 272, name: 'NORTH MUGIRANGO', county_id: 34 },
  { id: 273, name: 'BORABU', county_id: 34 },
  { id: 274, name: 'WESTLANDS', county_id: 30 },
  { id: 275, name: 'DAGORETTI NORTH', county_id: 30 },
  { id: 276, name: 'DAGORETTI SOUTH', county_id: 30 },
  { id: 277, name: 'LANGATA', county_id: 30 },
  { id: 278, name: 'KIBRA', county_id: 30 },
  { id: 279, name: 'ROYSAMBU', county_id: 30 },
  { id: 280, name: 'KASARANI', county_id: 30 },
  { id: 281, name: 'RUARAKA', county_id: 30 },
  { id: 282, name: 'EMBAKASI SOUTH', county_id: 30 },
  { id: 283, name: 'EMBAKASI NORTH', county_id: 30 },
  { id: 284, name: 'EMBAKASI CENTRAL', county_id: 30 },
  { id: 285, name: 'EMBAKASI EAST', county_id: 30 },
  { id: 286, name: 'EMBAKASI WEST', county_id: 30 },
  { id: 287, name: 'MAKADARA', county_id: 30 },
  { id: 288, name: 'KAMUKUNJI', county_id: 30 },
  { id: 289, name: 'STAREHE', county_id: 30 },
  { id: 290, name: 'MATHARE', county_id: 30 }
];

// Generate KENYAN_COUNTIES from COUNTIES_DATA
const KENYAN_COUNTIES = COUNTIES_DATA.map(county => county.name);

// Generate CONSTITUENCY_SUGGESTIONS from data
const CONSTITUENCY_SUGGESTIONS = {};
COUNTIES_DATA.forEach(county => {
  const countyConstituencies = CONSTITUENCIES_DATA
    .filter(constituency => constituency.county_id === county.id)
    .map(constituency => constituency.name);
  CONSTITUENCY_SUGGESTIONS[county.name] = countyConstituencies;
});

// Enhanced Google Maps URL parsing function
const parseGoogleMapsInput = (input) => {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();

  // Pattern 1: Direct coordinates (e.g., "-1.2921,36.8219")
  const directCoords = trimmed.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (directCoords) {
    const lat = parseFloat(directCoords[1]);
    const lng = parseFloat(directCoords[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng, source: 'direct_paste' };
    }
  }

  // Pattern 2: @lat,lng,zoom format (most common)
  const atPattern = trimmed.match(/@(-?\d+\.?\d+),(-?\d+\.?\d+),?(\d+\.?\d*)?z?/);
  if (atPattern) {
    const lat = parseFloat(atPattern[1]);
    const lng = parseFloat(atPattern[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng, source: 'at_pattern', zoom: parseFloat(atPattern[3]) };
    }
  }

  // Pattern 3: ?q=lat,lng format
  const qPattern = trimmed.match(/[?&]q=(-?\d+\.?\d+),(-?\d+\.?\d+)/);
  if (qPattern) {
    const lat = parseFloat(qPattern[1]);
    const lng = parseFloat(qPattern[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng, source: 'q_parameter' };
    }
  }

  // Pattern 4: !3dlat!4dlng format
  const dataPattern = trimmed.match(/!3d(-?\d+\.?\d+)!4d(-?\d+\.?\d+)/);
  if (dataPattern) {
    const lat = parseFloat(dataPattern[1]);
    const lng = parseFloat(dataPattern[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng, source: 'data_parameter' };
    }
  }

  // Pattern 5: /place/ with coordinates
  const placePattern = trimmed.match(/\/place\/([^/@?]+)\/@(-?\d+\.?\d+),(-?\d+\.?\d+)/);
  if (placePattern) {
    const lat = parseFloat(placePattern[2]);
    const lng = parseFloat(placePattern[3]);
    if (isValidCoordinate(lat, lng)) {
      const placeName = decodeURIComponent(placePattern[1]).replace(/\+/g, ' ');
      return { lat, lng, placeName, source: 'place_path' };
    }
  }

  // Pattern 6: Short URLs
  if (trimmed.match(/goo\.gl\/maps\/|maps\.app\.goo\.gl/)) {
    return { requiresExpansion: true, shortUrl: trimmed, source: 'short_url' };
  }

  // Pattern 7: Place name only
  const placeNamePattern = trimmed.match(/\/place\/([^/@?]+)/);
  if (placeNamePattern && !placeNamePattern[1].includes('@')) {
    const placeName = decodeURIComponent(placeNamePattern[1]).replace(/\+/g, ' ');
    return { placeName, requiresGeocoding: true, source: 'place_name' };
  }

  return null;
};

const isValidCoordinate = (lat, lng) => {
  const KENYA_BOUNDS = {
    minLat: -4.678, maxLat: 5.506,
    minLng: 33.908, maxLng: 41.899
  };

  return (!isNaN(lat) && !isNaN(lng) &&
    lat >= KENYA_BOUNDS.minLat && lat <= KENYA_BOUNDS.maxLat &&
    lng >= KENYA_BOUNDS.minLng && lng <= KENYA_BOUNDS.maxLng);
};

// Enhanced client-side URL expansion with timeout
const expandShortUrl = async (shortUrl) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(shortUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response.url;
  } catch (error) {
    clearTimeout(timeoutId);
    // Log removed for production

    return shortUrl;
  }
};

// Custom marker icons
const createCustomIcon = (color = '#34C759') => L.divIcon({
  className: 'contribution-marker',
  html: `<div style="width: 24px; height: 24px; background: ${color}; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
           <div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
         </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// Fuzzy search utility functions
const normalizeString = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
};

const fuzzyMatch = (query, target) => {
  const normalizedQuery = normalizeString(query);
  const normalizedTarget = normalizeString(target);

  if (normalizedTarget.includes(normalizedQuery)) return true;
  if (normalizedQuery.includes(normalizedTarget)) return true;

  // Levenshtein distance simple check for typos
  const maxDistance = Math.floor(Math.min(normalizedQuery.length, normalizedTarget.length) * 0.3);
  if (calculateLevenshteinDistance(normalizedQuery, normalizedTarget) <= maxDistance) return true;

  return false;
};

const calculateLevenshteinDistance = (a, b) => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

// Enhanced constituency code mapping function
const getConstituencyCodeFromData = (constituencyName, countyName) => {
  if (!constituencyName || !countyName) return null;

  const normalizedConstituency = normalizeString(constituencyName);
  const normalizedCounty = normalizeString(countyName);

  // Find the county using fuzzy matching
  const county = COUNTIES_DATA.find(c =>
    fuzzyMatch(normalizedCounty, c.name)
  );

  if (!county) {
    // Log removed for production

    return null;
  }

  // Find the constituency within the county using fuzzy matching
  const constituency = CONSTITUENCIES_DATA.find(c =>
    c.county_id === county.id && fuzzyMatch(normalizedConstituency, c.name)
  );

  if (!constituency) {
    // Log removed for production

    return null;
  }

  // Return the constituency ID as integer (not string with "CONST-" prefix)
  return constituency.id;
};

// Validation function for constituency-county match
const validateConstituencyCountyMatch = (constituencyName, countyName) => {
  if (!constituencyName || !countyName) return true;

  const normalizedConstituency = normalizeString(constituencyName);
  const normalizedCounty = normalizeString(countyName);

  const county = COUNTIES_DATA.find(c => fuzzyMatch(normalizedCounty, c.name));
  if (!county) return false;

  const constituency = CONSTITUENCIES_DATA.find(c =>
    c.county_id === county.id && fuzzyMatch(normalizedConstituency, c.name)
  );

  return !!constituency;
};

const ContributeLocationModal = ({ isOpen, onClose, onSuccess, userLocation }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [step, setStep] = useState(1);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [position, setPosition] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [notes, setNotes] = useState('');
  const [googleMapsInput, setGoogleMapsInput] = useState('');
  const [parseResult, setParseResult] = useState(null);
  const [isExpandingUrl, setIsExpandingUrl] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [formData, setFormData] = useState({
    submitted_office_location: '',
    submitted_county: '',
    submitted_constituency: '',
    submitted_landmark: ''
  });
  const [countyInput, setCountyInput] = useState('');
  const [constituencyInput, setConstituencyInput] = useState('');
  const [showCountySuggestions, setShowCountySuggestions] = useState(false);
  const [showConstituencySuggestions, setShowConstituencySuggestions] = useState(false);
  const [countySuggestions, setCountySuggestions] = useState([]);
  const [constituencySuggestions, setConstituencySuggestions] = useState([]);
  const [agreement, setAgreement] = useState(false);
  const [mapCenter, setMapCenter] = useState([-1.286389, 36.817223]);
  const [mapZoom, setMapZoom] = useState(6);
  const [isMapReady, setIsMapReady] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [contributionId, setContributionId] = useState(null);
  const [duplicateOffices, setDuplicateOffices] = useState([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [constituencyCode, setConstituencyCode] = useState(null);
  const [pinConfirmed, setPinConfirmed] = useState(false);
  const [showPinBubble, setShowPinBubble] = useState(false);

  const mapRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const markerRef = useRef(null);
  const fileInputRef = useRef(null);
  const retryCountRef = useRef(0);
  const countyInputRef = useRef(null);
  const constituencyInputRef = useRef(null);

  const {
    getCurrentPosition,
    convertImageToWebP,
    submitContribution,
    isSubmitting,
    error
  } = useContributeLocation();

  // Enhanced constituency code fetching with local data
  const fetchConstituencyCode = async (constituencyName, countyName) => {
    try {
      // Log removed for production

      const code = getConstituencyCodeFromData(constituencyName, countyName);
      // Log removed for production

      return code;
    } catch (error) {
      // Log removed for production

      return null;
    }
  };

  // Enhanced: Auto-fetch constituency code when constituency and county are selected
  useEffect(() => {
    const fetchCode = async () => {
      if (formData.submitted_constituency && formData.submitted_county) {
        try {
          const code = await fetchConstituencyCode(formData.submitted_constituency, formData.submitted_county);
          setConstituencyCode(code);
        } catch (error) {
          // Log removed for production

          setConstituencyCode(null);
        }
      } else {
        setConstituencyCode(null);
      }
    };

    const timeoutId = setTimeout(fetchCode, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.submitted_constituency, formData.submitted_county]);

  // County input handler with fuzzy search
  const handleCountyInputChange = (value) => {
    setCountyInput(value);
    setFormData(prev => ({ ...prev, submitted_county: value }));

    if (value.length > 1) {
      const suggestions = KENYAN_COUNTIES.filter(county =>
        fuzzyMatch(value, county)
      ).slice(0, 5);
      setCountySuggestions(suggestions);
      setShowCountySuggestions(true);
    } else {
      setShowCountySuggestions(false);
    }
  };

  // Constituency input handler with fuzzy search
  const handleConstituencyInputChange = (value) => {
    setConstituencyInput(value);
    setFormData(prev => ({ ...prev, submitted_constituency: value }));

    if (value.length > 1 && formData.submitted_county) {
      const countyConstituencies = CONSTITUENCY_SUGGESTIONS[formData.submitted_county] || [];
      const suggestions = countyConstituencies.filter(constituency =>
        fuzzyMatch(value, constituency)
      ).slice(0, 5);
      setConstituencySuggestions(suggestions);
      setShowConstituencySuggestions(true);
    } else {
      setShowConstituencySuggestions(false);
    }
  };

  // County selection handler
  const handleCountySelect = (countyName) => {
    setFormData(prev => ({ ...prev, submitted_county: countyName }));
    setCountyInput(countyName);
    setShowCountySuggestions(false);
    // Clear constituency when county changes
    setFormData(prev => ({ ...prev, submitted_constituency: '' }));
    setConstituencyInput('');
  };

  // Constituency selection handler
  const handleConstituencySelect = (constituencyName) => {
    setFormData(prev => ({ ...prev, submitted_constituency: constituencyName }));
    setConstituencyInput(constituencyName);
    setShowConstituencySuggestions(false);
  };

  // Safe duplicate office check function
  const safeFindDuplicateOffices = async (lat, lng, name, radius = 200) => {
    try {
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        throw new Error('Invalid coordinates');
      }

      // Validate Kenya bounds
      const KENYA_BOUNDS = {
        minLat: -4.678, maxLat: 5.506,
        minLng: 33.908, maxLng: 41.899
      };

      if (lat < KENYA_BOUNDS.minLat || lat > KENYA_BOUNDS.maxLat ||
        lng < KENYA_BOUNDS.minLng || lng > KENYA_BOUNDS.maxLng) {
        throw new Error('Coordinates outside Kenya bounds');
      }

      // Use direct Supabase query instead of RPC function
      const { data, error } = await supabase
        .from('iebc_office_contributions')
        .select('*')
        .lt('submitted_latitude', lat + 0.002) // ~200m radius
        .gt('submitted_latitude', lat - 0.002)
        .lt('submitted_longitude', lng + 0.002)
        .gt('submitted_longitude', lng - 0.002)
        .eq('status', 'verified');

      if (error) throw error;

      // Simple distance calculation
      const nearbyOffices = data?.filter(office => {
        const distance = Math.sqrt(
          Math.pow(office.submitted_latitude - lat, 2) +
          Math.pow(office.submitted_longitude - lng, 2)
        ) * 111000; // Convert to meters
        return distance < radius;
      }) || [];

      return nearbyOffices.map(office => ({
        ...office,
        is_likely_duplicate: true
      }));
    } catch (error) {
      // Log removed for production

      return [];
    }
  };

  // FIXED: Enhanced addMarkerToMap with proper retry limits
  const addMarkerToMap = useCallback((position, method = selectedMethod) => {
    if (!mapRef.current || !position || !position.lat || !position.lng) {
      // Log removed for production

      return;
    }

    if (isNaN(position.lat) || isNaN(position.lng)) {
      // Log removed for production

      return;
    }

    const addMarker = (retryCount = 0) => {
      if (retryCount > 3) {
        // Log removed for production

        return;
      }

      try {
        const mapInstance = mapRef.current;
        if (!mapInstance || typeof mapInstance.addLayer !== 'function') {
          // Log removed for production

          setTimeout(() => addMarker(retryCount + 1), 200);
          return;
        }

        if (markerRef.current) {
          mapInstance.removeLayer(markerRef.current);
        }

        markerRef.current = L.marker([position.lat, position.lng], {
          icon: createCustomIcon(),
          draggable: method === 'drop_pin'
        }).addTo(mapInstance);

        if (method === 'drop_pin') {
          markerRef.current.on('dragend', (event) => {
            const newPosition = event.target.getLatLng();
            if (newPosition && !isNaN(newPosition.lat) && !isNaN(newPosition.lng)) {
              setPosition({ lat: newPosition.lat, lng: newPosition.lng });
              setAccuracy(5);
            }
          });
        }
      } catch (error) {
        console.error('Error adding marker to map:', error);
      }
    };

    addMarker(0);
  }, [selectedMethod]);

  // FIXED: Enhanced addAccuracyCircle with proper retry limits
  const addAccuracyCircle = useCallback((position, accuracyValue) => {
    if (!mapRef.current || !position || !position.lat || !position.lng || !accuracyValue) {
      console.warn('Missing parameters for accuracy circle');
      return;
    }

    if (isNaN(position.lat) || isNaN(position.lng) || isNaN(accuracyValue) || accuracyValue <= 0) {
      console.warn('Invalid parameters for accuracy circle:', { position, accuracyValue });
      return;
    }

    const addCircle = (retryCount = 0) => {
      if (retryCount > 3) {
        console.warn('Max retries exceeded for adding accuracy circle');
        return;
      }

      try {
        const mapInstance = mapRef.current;
        if (!mapInstance || typeof mapInstance.addLayer !== 'function') {
          console.warn('Map instance not ready for adding accuracy circle, retrying...');
          setTimeout(() => addCircle(retryCount + 1), 200);
          return;
        }

        if (accuracyCircleRef.current) {
          mapInstance.removeLayer(accuracyCircleRef.current);
        }

        const limitedAccuracy = Math.min(accuracyValue, 1000);
        accuracyCircleRef.current = L.circle([position.lat, position.lng], {
          radius: limitedAccuracy,
          color: '#34C759',
          fillColor: '#34C759',
          fillOpacity: 0.1,
          weight: 2,
          opacity: 0.6
        }).addTo(mapInstance);
      } catch (error) {
        console.error('Error adding accuracy circle:', error);
      }
    };

    addCircle(0);
  }, []);

  // Handle map click function
  const handleMapClick = useCallback((e) => {
    if (selectedMethod === 'drop_pin' && e && e.latlng) {
      const { lat, lng } = e.latlng;

      if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        console.error('Invalid map click coordinates:', e.latlng);
        return;
      }

      const clickedPosition = { lat, lng };
      setPosition(clickedPosition);
      setAccuracy(5);

      if (mapRef.current) {
        mapRef.current.flyTo([lat, lng], 16, { duration: 0.5 });

        // Use setTimeout to ensure flyTo completes before adding layers
        setTimeout(() => {
          addMarkerToMap(clickedPosition, 'drop_pin');
          addAccuracyCircle(clickedPosition, 5);
        }, 300);
      }
    }
  }, [selectedMethod, addMarkerToMap, addAccuracyCircle]);

  // Handle map ready function - FIXED to properly handle map instance
  const handleMapReady = useCallback((map) => {
    console.log('Map is ready:', map);
    setIsMapReady(true);

    // Ensure click events are captured for drop pin mode
    if (map && typeof map.on === 'function') {
      map.on('click', handleMapClick);
    }

    if (position) {
      // Use setTimeout to ensure map layers are fully initialized
      setTimeout(() => {
        addMarkerToMap(position);
        addAccuracyCircle(position, accuracy);
      }, 200);
    }
  }, [position, accuracy, handleMapClick, addMarkerToMap, addAccuracyCircle]);

  // Initialize map with user location
  const initializeMapWithUserLocation = useCallback(() => {
    if (userLocation?.latitude && userLocation?.longitude) {
      const userPos = { lat: userLocation.latitude, lng: userLocation.longitude };
      setMapCenter([userLocation.latitude, userLocation.longitude]);
      setMapZoom(16);

      if (mapRef.current) {
        mapRef.current.flyTo([userLocation.latitude, userLocation.longitude], 16, { duration: 1 });
      }
    }
  }, [userLocation]);

  // Check for duplicate offices when position changes
  useEffect(() => {
    const checkDuplicateOffices = async () => {
      if (!position || typeof position.lat !== 'number' || typeof position.lng !== 'number') {
        return;
      }

      setIsCheckingDuplicates(true);
      try {
        const results = await safeFindDuplicateOffices(
          position.lat,
          position.lng,
          formData.submitted_office_location,
          200
        );
        setDuplicateOffices(results);
      } catch (error) {
        console.error('Duplicate check failed:', error);
        setDuplicateOffices([]);
      } finally {
        setIsCheckingDuplicates(false);
      }
    };

    const timeoutId = setTimeout(checkDuplicateOffices, 500);
    return () => clearTimeout(timeoutId);
  }, [position, formData.submitted_office_location]);

  // Show pin confirm bubble when position changes in drop_pin mode
  useEffect(() => {
    if (position && selectedMethod === 'drop_pin' && step === 2 && !pinConfirmed) {
      setShowPinBubble(true);
    }
  }, [position, selectedMethod, step, pinConfirmed]);

  // Auto-advance to details when position is set and confirmed (for non-GPS methods)
  useEffect(() => {
    if (position && selectedMethod !== 'current_location' && step === 2) {
      // For drop_pin: only auto-advance if pin is confirmed, with 20s fallback
      if (selectedMethod === 'drop_pin') {
        if (pinConfirmed) {
          const timer = setTimeout(() => {
            setStep(3);
          }, 300);
          return () => clearTimeout(timer);
        } else {
          // 20-second fallback timer
          const timer = setTimeout(() => {
            setPinConfirmed(true);
            setShowPinBubble(false);
            setStep(3);
          }, 20000);
          return () => clearTimeout(timer);
        }
      } else {
        // For google_maps method, keep original 1s auto-advance
        const timer = setTimeout(() => {
          setStep(3);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [position, selectedMethod, step, pinConfirmed]);

  // Handle pin confirm (tick)
  const handlePinConfirm = useCallback(() => {
    setPinConfirmed(true);
    setShowPinBubble(false);
  }, []);

  // Handle pin cancel (x) — reverts to step 1
  const handlePinCancel = useCallback(() => {
    setShowPinBubble(false);
    setPinConfirmed(false);
    setPosition(null);
    setAccuracy(null);
    setSelectedMethod(null);
    setStep(1);
  }, []);

  // Method selection handlers
  const handleMethodSelect = (method) => {
    setSelectedMethod(method);
    setStep(2);

    if (method === 'current_location') {
      handleCurrentLocation();
    } else if (method === 'drop_pin') {
      initializeMapWithUserLocation();
    }
  };

  // FIXED: Enhanced handleCurrentLocation with proper map readiness and auto-proceed to Step 3
  const handleCurrentLocation = async () => {
    setLocationError(null);
    setIsGettingLocation(true);
    retryCountRef.current = 0;

    try {
      const pos = await getCurrentPosition();

      if (!pos || !pos.latitude || !pos.longitude) {
        throw new Error('Failed to retrieve valid location data');
      }

      const { latitude, longitude, accuracy: posAccuracy = 50 } = pos;

      if (isNaN(latitude) || isNaN(longitude)) {
        throw new Error('Invalid coordinates received from GPS');
      }

      const capturedPosition = { lat: latitude, lng: longitude };
      const limitedAccuracy = Math.min(posAccuracy, 1000);

      setPosition(capturedPosition);
      setAccuracy(limitedAccuracy);
      setMapCenter([latitude, longitude]);
      setMapZoom(16);

      // Wait for map to be ready before adding layers
      if (mapRef.current) {
        mapRef.current.flyTo([latitude, longitude], 16, {
          duration: 1
        });

        // Use setTimeout to ensure flyTo completes before adding layers
        setTimeout(() => {
          addMarkerToMap(capturedPosition);
          addAccuracyCircle(capturedPosition, limitedAccuracy);
        }, 500);

        // Show accuracy guidance
        if (limitedAccuracy > 80) {
          setLocationError({
            type: 'warning',
            message: `GPS accuracy is low (±${Math.round(limitedAccuracy)}m). Please move to an open area or manually adjust the pin.`,
            action: {
              label: 'Adjust Pin Manually',
              onClick: () => {
                setSelectedMethod('drop_pin');
                setStep(2); // Ensure we stay/return to map step
                setLocationError(null);

                // Set initial position to map center if position is not yet set
                if (!position) {
                  setPosition({ lat: latitude, lng: longitude });
                }
              }
            }
          });
        } else if (limitedAccuracy <= 20) {
          setLocationError({
            type: 'success',
            message: 'Good accuracy (±' + Math.round(limitedAccuracy) + 'm). You\'re within the recommended 20m range.'
          });
        }
      } else {
        console.warn('Map ref not available for location update');
      }

      // AUTO-PROCEED TO STEP 3: Wait a moment then automatically proceed to office details
      // BUT ONLY if accuracy is good enough
      if (limitedAccuracy <= 80) {
        setTimeout(() => {
          setStep(3);
        }, 1500);
      }

    } catch (err) {
      console.error('Error capturing location:', err);
      const errorMessage = err?.message || 'Failed to get current location';
      setLocationError({
        type: 'error',
        message: errorMessage,
        action: {
          label: 'Try Drop Pin Method',
          onClick: () => setSelectedMethod('drop_pin')
        }
      });
    } finally {
      setIsGettingLocation(false);
    }
  };

  // FIXED: handleGoogleMapsParse with proper map readiness
  const handleGoogleMapsParse = async () => {
    if (!googleMapsInput.trim()) return;

    setIsExpandingUrl(true);
    setLocationError(null);

    try {
      let result = parseGoogleMapsInput(googleMapsInput);

      // Handle short URL expansion
      if (result?.requiresExpansion) {
        const expandedUrl = await expandShortUrl(result.shortUrl);
        result = parseGoogleMapsInput(expandedUrl);
      }

      if (result?.lat && result?.lng) {
        setParseResult(result);
        setPosition({ lat: result.lat, lng: result.lng });
        setMapCenter([result.lat, result.lng]);
        setMapZoom(16);

        if (mapRef.current) {
          mapRef.current.flyTo([result.lat, result.lng], 16, {
            duration: 1
          });

          // Use setTimeout to ensure flyTo completes before adding layers
          setTimeout(() => {
            addMarkerToMap({ lat: result.lat, lng: result.lng });
            addAccuracyCircle({ lat: result.lat, lng: result.lng }, 5);
          }, 500);
        } else {
          console.warn('Map not ready for flyTo operation');
        }

        // Auto-fill office name if available
        if (result.placeName && !formData.submitted_office_location) {
          setFormData(prev => ({
            ...prev,
            submitted_office_location: result.placeName
          }));
        }

        // Auto-proceed to Step 3 after successful parsing
        setTimeout(() => {
          setStep(3);
        }, 1000);
      } else if (result?.requiresGeocoding) {
        setLocationError({
          type: 'info',
          message: 'Could not extract exact coordinates. Please place a pin on the map manually.',
          action: {
            label: 'Switch to Drop Pin',
            onClick: () => setSelectedMethod('drop_pin')
          }
        });
      } else {
        setLocationError({
          type: 'error',
          message: 'Could not parse input. Please check the format and try again.'
        });
      }
    } catch (err) {
      console.error('Error parsing Google Maps input:', err);
      setLocationError({
        type: 'error',
        message: 'Failed to process the Google Maps link'
      });
    } finally {
      setIsExpandingUrl(false);
    }
  };

  const handleImageSelect = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file (JPEG, PNG, etc.)');
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Image must be smaller than 10MB');
      }

      const webpFile = await convertImageToWebP(file);
      setImageFile(webpFile);

      const previewUrl = URL.createObjectURL(webpFile);
      setImagePreview(previewUrl);
    } catch (err) {
      console.error('Error processing image:', err);
      setLocationError({
        type: 'error',
        message: err.message
      });
    }
  }, [convertImageToWebP]);

  const handleRemoveImage = useCallback(() => {
    setImageFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [imagePreview]);

  const handleFinalSubmit = async () => {
    if (!position || !agreement) {
      setLocationError({
        type: 'error',
        message: 'Please confirm your agreement and ensure location is set.'
      });
      return;
    }

    try {
      // Validate constituency and county match
      const isValidMatch = validateConstituencyCountyMatch(
        formData.submitted_constituency,
        formData.submitted_county
      );

      if (!isValidMatch) {
        setLocationError({
          type: 'error',
          message: 'The selected constituency does not belong to the selected county. Please check your entries.'
        });
        return;
      }

      const contributionData = {
        submitted_latitude: position.lat,
        submitted_longitude: position.lng,
        submitted_accuracy_meters: accuracy || 50,
        submitted_office_location: formData.submitted_office_location,
        submitted_county: formData.submitted_county,
        submitted_constituency: formData.submitted_constituency,
        submitted_constituency_id: constituencyCode, // Use the integer ID directly
        submitted_landmark: formData.submitted_landmark || notes,
        google_maps_link: selectedMethod === 'google_maps' ? googleMapsInput : null,
        imageFile: imageFile,
        capture_method: selectedMethod,
        capture_source: parseResult?.source || 'manual',
        duplicate_count: duplicateOffices.length,
        device_metadata: {
          user_agent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          timestamp: new Date().toISOString(),
          capture_method: selectedMethod,
          capture_source: parseResult?.source || 'manual',
          accuracy: accuracy || 50,
          duplicate_count: duplicateOffices.length,
          screen_resolution: `${window.screen.width}x${window.screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          has_touch: 'ontouchstart' in window,
          constituency_id: constituencyCode // FIXED: Use correct field name
        }
      };

      console.log('Submitting contribution data with constituency code:', constituencyCode, contributionData);

      const result = await submitContribution(contributionData);
      setContributionId(result.id);
      setSubmissionSuccess(true);

      if (onSuccess) {
        onSuccess(result);
      }

      setStep(4);
    } catch (err) {
      console.error('Submission error:', err);
      setLocationError({
        type: 'error',
        message: err.message || 'Failed to submit contribution. Please try again.'
      });
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.submitted_office_location.trim()) {
      setLocationError({
        type: 'error',
        message: 'Please provide an office name.'
      });
      return;
    }

    if (!formData.submitted_county) {
      setLocationError({
        type: 'error',
        message: 'Please select a county.'
      });
      return;
    }

    if (!formData.submitted_constituency.trim()) {
      setLocationError({
        type: 'error',
        message: 'Please provide a constituency.'
      });
      return;
    }

    handleFinalSubmit();
  };

  const resetForm = useCallback(() => {
    setStep(1);
    setSelectedMethod(null);
    setPosition(null);
    setAccuracy(null);
    setImageFile(null);
    setImagePreview(null);
    setNotes('');
    setGoogleMapsInput('');
    setParseResult(null);
    setFormData({
      submitted_office_location: '',
      submitted_county: '',
      submitted_constituency: '',
      submitted_landmark: ''
    });
    setCountyInput('');
    setConstituencyInput('');
    setShowCountySuggestions(false);
    setShowConstituencySuggestions(false);
    setCountySuggestions([]);
    setConstituencySuggestions([]);
    setAgreement(false);
    setLocationError(null);
    setSubmissionSuccess(false);
    setContributionId(null);
    setDuplicateOffices([]);
    setConstituencyCode(null);
    setPinConfirmed(false);
    setShowPinBubble(false);
    retryCountRef.current = 0;

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    // Clean up map layers
    if (markerRef.current && mapRef.current && typeof mapRef.current.removeLayer === 'function') {
      try {
        mapRef.current.removeLayer(markerRef.current);
      } catch (e) {
        console.warn('Error removing marker:', e);
      }
      markerRef.current = null;
    }
    if (accuracyCircleRef.current && mapRef.current && typeof mapRef.current.removeLayer === 'function') {
      try {
        mapRef.current.removeLayer(accuracyCircleRef.current);
      } catch (e) {
        console.warn('Error removing accuracy circle:', e);
      }
      accuracyCircleRef.current = null;
    }
  }, [imagePreview]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // Enhanced error display component
  const ErrorAlert = ({ error }) => {
    if (!error) return null;

    const alertStyles = {
      error: 'bg-red-50 border-red-200 text-red-700',
      warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
      success: 'bg-green-50 border-green-200 text-green-700',
      info: 'bg-blue-50 border-blue-200 text-blue-700'
    };

    const icons = {
      error: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
      warning: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
      success: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      info: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    };

    return (
      <div className={`mb-4 border rounded-xl p-4 ${alertStyles[error.type]}`}>
        <div className="flex items-center space-x-3">
          {icons[error.type]}
          <div className="flex-1">
            <p className="text-sm font-medium">{error.message}</p>
            {error.action && (
              <button
                onClick={error.action.onClick}
                className="mt-2 text-sm font-medium underline hover:no-underline"
              >
                {error.action.label}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Enhanced constituency status component
  const ConstituencyStatus = ({ constituency, county, code }) => {
    if (!constituency || !county) return null;

    const isValidMatch = validateConstituencyCountyMatch(constituency, county);

    if (code && isValidMatch) {
      return (
        <div className="mt-1">
          <p className="text-xs text-green-600 flex items-center gap-1">
            <Check className="w-3 h-3" />
            Valid constituency: {constituency} in {county}
          </p>
          <p className="text-xs text-green-600 flex items-center gap-1">
            <Check className="w-3 h-3" />
            Code: {code}
          </p>
        </div>
      );
    }

    if (!isValidMatch) {
      return (
        <div className="mt-1">
          <p className="text-xs text-red-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            "{constituency}" is not a valid constituency in {county}
          </p>
          <p className="text-xs text-gray-500 mt-1">Please select a valid constituency from the suggestions.</p>
        </div>
      );
    }

    return (
      <div className="mt-1">
        <p className="text-xs text-yellow-600 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Constituency validated but code not available
        </p>
        <p className="text-xs text-gray-500 mt-1">This won't affect your submission. The constituency is valid.</p>
      </div>
    );
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`relative w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border ${isDark ? 'bg-black/80 border-white/10' : 'bg-white/95 border-black/5'} backdrop-blur-3xl rounded-[32px]`}
          >
            {/* Header with progress indicator */}
            <div className={`flex-shrink-0 flex items-center justify-between p-6 border-b ${isDark ? 'border-white/10' : 'border-black/5'} backdrop-blur-md bg-transparent relative z-10`}>
              <div className="flex items-center space-x-6">
                <h2 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {step === 1 && 'Contribute Location'}
                  {step === 2 && 'Capture Location'}
                  {step === 3 && 'Office Details'}
                  {step === 4 && 'Success'}
                </h2>

                {/* iOS-style premium progress indicator */}
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 rounded-full transition-all duration-500 ease-out ${i <= step
                          ? (isDark ? 'w-6 bg-ios-blue shadow-[0_0_8px_#007AFF80]' : 'w-6 bg-ios-blue')
                          : 'w-2 bg-gray-200 opacity-50'
                          }`}
                      />
                    ))}
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-white/30' : 'text-black/20'}`}>
                    Step {step < 4 ? step : 'Done'}
                  </span>
                </div>
              </div>

              <button
                onClick={handleClose}
                className={`transition-all p-2 rounded-full active:scale-90 ${isDark ? 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white' : 'bg-black/5 text-black/40 hover:bg-black/10 hover:text-black'}`}
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <ErrorAlert error={locationError} />

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Step 1: Method Selection */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <div className={`w-20 h-20 mx-auto mb-6 relative`}>
                      <div className={`absolute inset-0 rounded-[24px] blur-2xl opacity-20 ${isDark ? 'bg-ios-blue' : 'bg-ios-blue'}`}></div>
                      <div className={`relative w-full h-full rounded-[24px] flex items-center justify-center border shadow-lg overflow-hidden ${isDark ? 'bg-ios-gray-800/80 border-white/10' : 'bg-ios-gray-100/80 border-black/5'}`}>
                        <img src="/icons/location-main.svg" className="w-10 h-10 object-contain" alt="Location" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                        <MapPin style={{ display: 'none' }} className={`w-10 h-10 ${isDark ? 'text-ios-blue' : 'text-ios-blue'}`} />
                      </div>
                    </div>
                    <h3 className={`text-2xl font-black tracking-tight mb-2 ${isDark ? 'text-white' : 'text-black'}`}>How to contribute?</h3>
                    <p className={`text-sm font-medium opacity-50 ${isDark ? 'text-white' : 'text-black'}`}>Choose your capture method</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <button
                      onClick={() => handleMethodSelect('current_location')}
                      className={`p-6 rounded-[28px] border transition-all text-left focus:outline-none focus:ring-2 focus:ring-ios-green group relative overflow-hidden active:scale-[0.97] duration-300 shadow-sm hover:shadow-xl ${isDark
                        ? 'bg-ios-gray-800/30 border-white/5 hover:bg-ios-gray-800/50'
                        : 'bg-white border-black/5 hover:bg-ios-gray-50'}`}
                      aria-label="Use my current location"
                    >
                      <div className="flex items-center space-x-5 relative z-10">
                        <div className={`w-16 h-16 rounded-[20px] flex items-center justify-center transition-transform group-hover:scale-110 shadow-inner ${isDark ? 'bg-ios-green/10' : 'bg-ios-green/10'}`}>
                          <img src="/icons/location-current.svg" className="w-8 h-8 object-contain" alt="" onError={(e) => { e.target.src = '/icons/compass-svgrepo-com.svg'; }} />
                        </div>
                        <div className="flex-1">
                          <h4 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-black'}`}>Use My Current Location</h4>
                          <p className={`text-sm font-medium opacity-50 ${isDark ? 'text-white' : 'text-black'}`}>Capture your mobile GPS coordinates</p>
                          <div className={`mt-2 flex items-center gap-1.5`}>
                            <div className="w-4 h-4 rounded-full bg-ios-green/20 flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-ios-green" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-ios-green">Most Accurate</span>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center border border-black/5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className={`w-4 h-4 ${isDark ? 'text-white/30' : 'text-black/30'}`} />
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleMethodSelect('drop_pin')}
                      className={`p-6 rounded-[28px] border transition-all text-left focus:outline-none focus:ring-2 focus:ring-ios-blue group relative overflow-hidden active:scale-[0.97] duration-300 shadow-sm hover:shadow-xl ${isDark
                        ? 'bg-ios-gray-800/30 border-white/5 hover:bg-ios-gray-800/50'
                        : 'bg-white border-black/5 hover:bg-ios-gray-50'}`}
                      aria-label="Drop a pin on map"
                    >
                      <div className="flex items-center space-x-5 relative z-10">
                        <div className={`w-16 h-16 rounded-[20px] flex items-center justify-center transition-transform group-hover:scale-110 shadow-inner ${isDark ? 'bg-ios-blue/10' : 'bg-ios-blue/10'}`}>
                          <img src="/icons/location-pin.svg" className="w-8 h-8 object-contain" alt="" onError={(e) => { e.target.src = '/icons/map-pin-svgrepo-com.svg'; }} />
                        </div>
                        <div className="flex-1">
                          <h4 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-black'}`}>Drop a Pin on Map</h4>
                          <p className={`text-sm font-medium opacity-50 ${isDark ? 'text-white' : 'text-black'}`}>Manually place a marker on the map</p>
                          <div className={`mt-2 flex items-center gap-1.5`}>
                            <div className="w-4 h-4 rounded-full bg-ios-blue/20 flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-ios-blue" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-ios-blue">Precise Control</span>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center border border-black/5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className={`w-4 h-4 ${isDark ? 'text-white/30' : 'text-black/30'}`} />
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleMethodSelect('google_maps')}
                      className={`p-6 rounded-[28px] border transition-all text-left focus:outline-none focus:ring-2 focus:ring-ios-red group relative overflow-hidden active:scale-[0.97] duration-300 shadow-sm hover:shadow-xl ${isDark
                        ? 'bg-ios-gray-800/30 border-white/5 hover:bg-ios-gray-800/50'
                        : 'bg-white border-black/5 hover:bg-ios-gray-50'}`}
                      aria-label="Paste Google Maps link"
                    >
                      <div className="flex items-center space-x-5 relative z-10">
                        <div className={`w-16 h-16 rounded-[20px] flex items-center justify-center transition-transform group-hover:scale-110 shadow-inner ${isDark ? 'bg-ios-red/10' : 'bg-ios-red/10'}`}>
                          <img src="/icons/location-link.svg" className="w-8 h-8 object-contain" alt="" onError={(e) => { e.target.src = '/icons/Google_Maps_icon_(2026).svg'; }} />
                        </div>
                        <div className="flex-1">
                          <h4 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-black'}`}>Paste Google Maps Link</h4>
                          <p className={`text-sm font-medium opacity-50 ${isDark ? 'text-white' : 'text-black'}`}>Share a URL from your map app</p>
                          <div className={`mt-2 flex items-center gap-1.5`}>
                            <div className="w-4 h-4 rounded-full bg-ios-red/20 flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-ios-red" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-ios-red">Fast Extraction</span>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center border border-black/5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className={`w-4 h-4 ${isDark ? 'text-white/30' : 'text-black/30'}`} />
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="text-sm text-green-700">
                        <p className="font-medium">Privacy Notice</p>
                        <p>We only collect location data pertaining to IEBC offices for public benefit. No personal information is stored. All submissions are moderated before being published.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Location Capture */}
              {step === 2 && (
                <div className="space-y-6">
                  {selectedMethod === 'current_location' && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Capture Your Current Location</h3>
                      <p className="text-gray-600 mb-4">Stand within 20 meters of the IEBC office entrance for best accuracy</p>

                      {position && accuracy && (
                        <div className="bg-blue-50 rounded-lg p-4 mb-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-700">
                              Accuracy: ±{Math.round(accuracy)} meters
                            </span>
                            {accuracy <= 20 && (
                              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                Good Accuracy
                              </span>
                            )}
                          </div>
                          {accuracy > 100 && (
                            <p className="text-sm text-blue-600 mt-1">
                              Move to an open area for better GPS accuracy
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedMethod === 'drop_pin' && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Drop a Pin on the Map</h3>
                      <p className="text-gray-600">Click on the exact location of the IEBC office. Drag the pin to adjust.</p>
                    </div>
                  )}

                  {selectedMethod === 'google_maps' && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Paste Google Maps Link</h3>
                      <p className="text-gray-600 mb-4">Paste a Google Maps URL or coordinates in format: -1.2921,36.8219</p>

                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={googleMapsInput}
                          onChange={(e) => setGoogleMapsInput(e.target.value)}
                          placeholder="https://maps.google.com/place/... or -1.2921,36.8219"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                          aria-label="Google Maps link or coordinates"
                        />
                        <button
                          onClick={handleGoogleMapsParse}
                          disabled={!googleMapsInput.trim() || isExpandingUrl}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {isExpandingUrl ? (
                            <div className="flex items-center space-x-2">
                              <LoadingSpinner size="small" />
                              <span>Processing...</span>
                            </div>
                          ) : (
                            'Parse'
                          )}
                        </button>
                      </div>

                      {parseResult && (
                        <div className="bg-green-50 rounded-lg p-3 mt-2">
                          <p className="text-sm text-green-700 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Coordinates extracted: {parseResult.lat.toFixed(6)}, {parseResult.lng.toFixed(6)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Map Preview */}
                  {(selectedMethod === 'current_location' || selectedMethod === 'drop_pin' || parseResult) && (
                    <div className={`relative h-[480px] rounded-[32px] overflow-hidden border ${isDark ? 'border-white/10 bg-black/20' : 'border-black/5 bg-gray-100'} shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)]`}>
                      <MapContainer
                        center={mapCenter}
                        zoom={mapZoom}
                        className="h-full w-full"
                        onMapReady={handleMapReady}
                        onClick={handleMapClick}
                        onMove={(center) => {
                          if (selectedMethod === 'drop_pin') {
                            setPosition({ lat: center.lat, lng: center.lng });
                            setAccuracy(5);
                          }
                        }}
                        isModalMap={true}
                        ref={mapRef}
                      >
                        <GeoJSONLayerManager
                          activeLayers={['iebc-offices']}
                          onOfficeSelect={() => { }}
                          selectedOffice={null}
                          onNearbyOfficesFound={() => { }}
                          baseMap="standard"
                          isModalMap={true}
                        />
                        {userLocation && (
                          <UserLocationMarker
                            position={[userLocation.latitude, userLocation.longitude]}
                            accuracy={Math.min(userLocation.accuracy, 1000)}
                          />
                        )}
                        {position && selectedMethod !== 'drop_pin' && (
                          <UserLocationMarker
                            position={[position.lat, position.lng]}
                            accuracy={accuracy}
                            color="#34C759"
                          />
                        )}
                      </MapContainer>

                      {/* Premium Stationary Crosshair Pin */}
                      {selectedMethod === 'drop_pin' && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-[1000]">
                          <motion.div
                            initial={{ y: -40, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ type: 'spring', damping: 15 }}
                            className="flex flex-col items-center"
                          >
                            <div className="relative mb-6">
                              {/* Floating Badge */}
                              <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-ios-blue text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-ios-blue/30 border border-white/20">
                                Set Location
                              </div>

                              {/* The Pin Body */}
                              <div className="w-10 h-10 bg-ios-blue border-[3px] border-white rounded-full shadow-2xl flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                              </div>

                              {/* Needle */}
                              <div className="w-1 h-8 bg-ios-blue mx-auto -mt-1 rounded-full shadow-xl"></div>

                              {/* Shadow/Contact Point */}
                              <div className="w-2 h-1 bg-black/20 rounded-full blur-[2px] mx-auto mt-0.5 scale-x-[4.0]"></div>
                            </div>
                          </motion.div>
                        </div>
                      )}

                      {/* Glassmorphic Overlay Controls */}
                      <div className="absolute top-4 left-4 right-4 pointer-events-none flex flex-col items-center gap-2 z-[1001]">
                        <motion.div
                          initial={{ y: -20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          className={`backdrop-blur-xl px-4 py-2 rounded-2xl shadow-xl border flex items-center gap-3 transition-colors ${isDark ? 'bg-black/60 border-white/10 text-white' : 'bg-white/80 border-white/50 text-gray-900'}`}
                        >
                          <div className={`w-2 h-2 rounded-full ${pinConfirmed ? 'bg-ios-green' : 'bg-ios-blue animate-pulse'}`}></div>
                          <span className="text-xs font-black uppercase tracking-wider">
                            {pinConfirmed ? 'Location Locked' : (selectedMethod === 'drop_pin' ? 'Pan map to center office' : 'Capturing Live coordinates')}
                          </span>
                        </motion.div>

                        {selectedMethod === 'current_location' && accuracy && (
                          <div className={`backdrop-blur-md px-3 py-1.5 rounded-xl border text-[10px] font-bold tracking-tight shadow-lg ${isDark ? 'bg-white/5 border-white/10 text-white/70' : 'bg-black/5 border-black/5 text-black/60'}`}>
                            GPS PRECISION: ±{Math.round(accuracy)}m
                          </div>
                        )}
                      </div>

                      {/* Pin Confirm Bubble — iOS Style */}
                      {selectedMethod === 'drop_pin' && showPinBubble && position && !pinConfirmed && (
                        <div className="absolute inset-0 pointer-events-none z-[1002]">
                          <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-8 flex pointer-events-auto gap-4"
                          >
                            <button
                              onClick={handlePinCancel}
                              className="w-14 h-14 bg-white/90 backdrop-blur-xl border border-black/5 rounded-full shadow-xl flex items-center justify-center group active:scale-90 transition-transform"
                            >
                              <X className="w-6 h-6 text-ios-red group-hover:scale-110 transition-transform" />
                            </button>
                            <button
                              onClick={handlePinConfirm}
                              className="w-14 h-14 bg-ios-blue border border-white/20 rounded-full shadow-xl shadow-ios-blue/40 flex items-center justify-center group active:scale-90 transition-transform"
                            >
                              <Check className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                            </button>
                          </motion.div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Duplicate Office Warning */}
                  {duplicateOffices.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-yellow-800 mb-1">
                            Possible duplicate office detected
                          </p>
                          <p className="text-sm text-yellow-700">
                            There {duplicateOffices.length === 1 ? 'is' : 'are'} {duplicateOffices.length} verified office{duplicateOffices.length === 1 ? '' : 's'} within 100m. Please confirm this is a new location.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-3 pt-6">
                    <button
                      onClick={() => setStep(1)}
                      className={`flex-1 px-4 py-4 rounded-2xl font-bold transition-all active:scale-[0.98] duration-300 border shadow-md flex items-center justify-center space-x-2 ${isDark
                        ? 'bg-ios-gray-800/40 border-white/10 text-ios-gray-400 hover:bg-ios-gray-800/60'
                        : 'bg-ios-gray-100 border-black/5 text-ios-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                      </svg>
                      <span>Back</span>
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      disabled={!position || isGettingLocation}
                      className={`flex-1 px-4 py-4 rounded-2xl font-bold transition-all active:scale-[0.98] duration-300 shadow-xl flex items-center justify-center space-x-2 text-white disabled:opacity-50 disabled:cursor-not-allowed ${isDark
                        ? 'bg-ios-blue-600 shadow-ios-blue/30 border border-white/10'
                        : 'bg-ios-blue shadow-ios-blue/20 border border-black/5'
                        }`}
                    >
                      {isGettingLocation ? (
                        <div className="flex items-center justify-center space-x-2">
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          <span>Getting Location...</span>
                        </div>
                      ) : (
                        <>
                          <span>Continue to Details</span>
                          <svg className="w-5 h-5 flex-shrink-0 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Office Details Form */}
              {step === 3 && (
                <form onSubmit={handleFormSubmit} className="space-y-6">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>Office Information</h3>
                      <p className={`text-sm opacity-50 ${isDark ? 'text-white' : 'text-black'}`}>Complete the verified listing</p>
                    </div>
                    {/* iOS Sub-action button */}
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border flex items-center gap-2 active:scale-95 ${isDark ? 'bg-white/5 border-white/10 text-ios-blue hover:bg-white/10' : 'bg-ios-blue/5 border-ios-blue/10 text-ios-blue hover:bg-ios-blue/10'}`}
                    >
                      <MapPin className="w-3 h-3" />
                      <span>Refine Pin</span>
                    </button>
                  </div>

                  <div className="space-y-5">
                    <div className="relative group">
                      <label className={`block text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1 ${isDark ? 'text-white/40' : 'text-black/40'}`}>
                        Office Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.submitted_office_location}
                        onChange={(e) => setFormData(prev => ({ ...prev, submitted_office_location: e.target.value }))}
                        placeholder="e.g., IEBC Eldoret County Office"
                        className={`w-full px-5 py-4 rounded-2xl border transition-all outline-none focus:ring-2 focus:ring-ios-blue/50 ${isDark
                          ? 'bg-ios-gray-800/40 border-white/10 text-white placeholder:text-white/20'
                          : 'bg-ios-gray-50 border-black/5 text-gray-900 placeholder:text-black/20'}`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative">
                        <label className={`block text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1 ${isDark ? 'text-white/40' : 'text-black/40'}`}>
                          County *
                        </label>
                        <input
                          ref={countyInputRef}
                          type="text"
                          required
                          value={countyInput}
                          onChange={(e) => handleCountyInputChange(e.target.value)}
                          onFocus={() => setShowCountySuggestions(countyInput.length > 1)}
                          onBlur={() => setTimeout(() => setShowCountySuggestions(false), 200)}
                          placeholder="Search County..."
                          className={`w-full px-5 py-4 rounded-2xl border transition-all outline-none focus:ring-2 focus:ring-ios-blue/50 ${isDark
                            ? 'bg-ios-gray-800/40 border-white/10 text-white placeholder:text-white/20'
                            : 'bg-ios-gray-50 border-black/5 text-gray-900 placeholder:text-black/20'}`}
                        />

                        {showCountySuggestions && countySuggestions.length > 0 && (
                          <div className={`absolute z-20 w-full mt-2 rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-xl ${isDark ? 'bg-ios-gray-800/90 border-white/10' : 'bg-white/95 border-black/5'}`}>
                            {countySuggestions.map((county, index) => (
                              <button
                                key={index}
                                type="button"
                                className={`w-full px-5 py-3 text-left text-sm font-semibold transition-colors ${isDark ? 'text-white hover:bg-white/10' : 'text-black hover:bg-black/5'}`}
                                onClick={() => handleCountySelect(county)}
                              >
                                {county}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="relative">
                        <label className={`block text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1 ${isDark ? 'text-white/40' : 'text-black/40'}`}>
                          Constituency *
                        </label>
                        <input
                          ref={constituencyInputRef}
                          type="text"
                          required
                          value={constituencyInput}
                          onChange={(e) => handleConstituencyInputChange(e.target.value)}
                          onFocus={() => formData.submitted_county && setShowConstituencySuggestions(constituencyInput.length > 0)}
                          onBlur={() => setTimeout(() => setShowConstituencySuggestions(false), 200)}
                          placeholder="Search..."
                          className={`w-full px-5 py-4 rounded-2xl border transition-all outline-none focus:ring-2 focus:ring-ios-blue/50 ${isDark
                            ? 'bg-ios-gray-800/40 border-white/10 text-white placeholder:text-white/20'
                            : 'bg-ios-gray-50 border-black/5 text-gray-900 placeholder:text-black/20'}`}
                        />

                        {showConstituencySuggestions && constituencySuggestions.length > 0 && (
                          <div className={`absolute z-20 w-full mt-2 rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-xl ${isDark ? 'bg-ios-gray-800/90 border-white/10' : 'bg-white/95 border-black/5'}`}>
                            {constituencySuggestions.map((constituency, index) => (
                              <button
                                key={index}
                                type="button"
                                className={`w-full px-5 py-3 text-left text-sm font-semibold transition-colors ${isDark ? 'text-white hover:bg-white/10' : 'text-black hover:bg-black/5'}`}
                                onClick={() => handleConstituencySelect(constituency)}
                              >
                                {constituency}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="px-1">
                          <ConstituencyStatus
                            constituency={formData.submitted_constituency}
                            county={formData.submitted_county}
                            code={constituencyCode}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="relative group">
                      <label className={`block text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1 ${isDark ? 'text-white/40' : 'text-black/40'}`}>
                        Photo of the Office (Optional)
                      </label>
                      <div className="flex items-center gap-4">
                        <label className="flex-1 cursor-pointer">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleImageSelect}
                            className="hidden"
                          />
                          <div className={`border-2 border-dashed rounded-[24px] p-6 text-center transition-all ${isDark
                            ? 'border-white/10 bg-white/5 hover:border-ios-blue hover:bg-ios-blue/5'
                            : 'border-black/5 bg-ios-gray-50 hover:border-ios-blue hover:bg-ios-blue/5'}`}>
                            <Camera className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-white/20' : 'text-black/20'}`} />
                            <p className={`text-xs font-bold ${isDark ? 'text-white/40' : 'text-black/40'}`}>
                              {imageFile ? 'Photo Staged' : 'Tap to capture or upload'}
                            </p>
                          </div>
                        </label>
                        {imagePreview && (
                          <div className="relative">
                            <img src={imagePreview} alt="Preview" className="w-24 h-24 object-cover rounded-[20px] shadow-2xl border-2 border-white" />
                            <button
                              type="button"
                              onClick={handleRemoveImage}
                              className="absolute -top-3 -right-3 bg-ios-red text-white rounded-full p-2 shadow-lg active:scale-90 transition-transform"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="relative group">
                      <label className={`block text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1 ${isDark ? 'text-white/40' : 'text-black/40'}`}>
                        Additional Landmark / Notes
                      </label>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g., Near the main gate..."
                        className={`w-full px-5 py-4 rounded-2xl border transition-all outline-none focus:ring-2 focus:ring-ios-blue/50 resize-none ${isDark
                          ? 'bg-ios-gray-800/40 border-white/10 text-white placeholder:text-white/20'
                          : 'bg-ios-gray-50 border-black/5 text-gray-900 placeholder:text-black/20'}`}
                      />
                    </div>

                    <div className={`p-4 rounded-2xl border flex items-start gap-4 transition-colors ${agreement ? (isDark ? 'bg-ios-green/10 border-ios-green/30' : 'bg-ios-green/5 border-ios-green/20') : (isDark ? 'bg-white/5 border-white/10 opacity-70' : 'bg-black/5 border-black/5')}`}>
                      <div className="pt-0.5">
                        <input
                          id="agreement"
                          type="checkbox"
                          required
                          checked={agreement}
                          onChange={(e) => setAgreement(e.target.checked)}
                          className={`w-5 h-5 rounded-lg border-2 transition-all appearance-none cursor-pointer flex items-center justify-center ${agreement
                            ? 'bg-ios-green border-ios-green checked:bg-ios-green'
                            : 'bg-transparent border-gray-400'}`}
                          style={{
                            backgroundImage: agreement ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E")` : 'none',
                            backgroundSize: '12px',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat'
                          }}
                        />
                      </div>
                      <label htmlFor="agreement" className={`text-xs font-bold leading-relaxed cursor-pointer select-none ${isDark ? 'text-white/60' : 'text-black/60'}`}>
                        Confirm accuracy. I agree to the <span className="text-ios-blue underline">Verification Standards</span> and understand my coordinates will be used to help others.
                      </label>
                    </div>
                  </div>

                  <div className="flex space-x-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className={`flex-1 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[12px] transition-all active:scale-95 border ${isDark
                        ? 'bg-white/5 border-white/10 text-white'
                        : 'bg-black/5 border-black/5 text-black'}`}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={!agreement || isSubmitting}
                      className={`flex-1 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[12px] transition-all active:scale-95 shadow-xl shadow-ios-blue/30 text-white disabled:opacity-30 ${isSubmitting ? 'bg-ios-blue/50' : 'bg-ios-blue'}`}
                    >
                      {isSubmitting ? 'Submitting...' : 'Upload Verified Pin'}
                    </button>
                  </div>
                </form>
              )}

              {/* Step 4: Submission Complete */}
              {step === 4 && (
                <div className="text-center space-y-8 py-4">
                  {submissionSuccess ? (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="space-y-8"
                    >
                      <div className="relative w-24 h-24 mx-auto">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', damping: 12, delay: 0.2 }}
                          className="absolute inset-0 bg-ios-green rounded-full shadow-[0_0_40px_rgba(52,199,89,0.4)] flex items-center justify-center border-4 border-white"
                        >
                          <Check className="w-12 h-12 text-white stroke-[4]" />
                        </motion.div>
                        <motion.div
                          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="absolute inset-0 bg-ios-green rounded-full"
                        />
                      </div>

                      <div>
                        <h3 className={`text-2xl font-black tracking-tight mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Verification Pending</h3>
                        <p className={`text-sm font-medium opacity-50 ${isDark ? 'text-white' : 'text-black'}`}>Your contribution is in the moderation queue</p>
                      </div>

                      <div className="grid grid-cols-1 gap-4 text-left">
                        <div className={`p-5 rounded-[24px] border transition-all ${isDark ? 'bg-ios-green/10 border-ios-green/20' : 'bg-ios-green/5 border-ios-green/10'}`}>
                          <h4 className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isDark ? 'text-ios-green' : 'text-ios-green'}`}>Next Steps</h4>
                          <ul className="space-y-3">
                            {[
                              'Our team will verify the coordinate accuracy',
                              'Office details will be cross-referenced with DB',
                              'Upon approval, the pin will go live globally'
                            ].map((text, i) => (
                              <li key={i} className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full bg-ios-green/20 flex items-center justify-center flex-shrink-0">
                                  <Check className="w-3 h-3 text-ios-green" />
                                </div>
                                <span className={`text-xs font-bold ${isDark ? 'text-white/80' : 'text-black/70'}`}>{text}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className={`p-5 rounded-[24px] border transition-all ${isDark ? 'bg-white/5 border-white/10' : 'bg-ios-gray-50 border-black/5'}`}>
                          <div className="flex justify-between items-center mb-1">
                            <span className={`text-[10px] font-black uppercase tracking-widest opacity-40 ${isDark ? 'text-white' : 'text-black'}`}>Contribution Ticket</span>
                            <span className="text-[10px] font-black text-ios-blue uppercase tracking-widest bg-ios-blue/10 px-2 py-0.5 rounded-full">Active</span>
                          </div>
                          <p className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>#{contributionId}</p>
                          {constituencyCode && (
                            <p className={`text-[10px] font-bold mt-1 opacity-50 ${isDark ? 'text-white' : 'text-black'}`}>WARD/CONST CODE: {constituencyCode}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex space-x-4">
                        <button
                          onClick={handleClose}
                          className={`flex-1 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[12px] transition-all active:scale-95 border ${isDark
                            ? 'bg-white/5 border-white/10 text-white'
                            : 'bg-black/5 border-black/5 text-black'}`}
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => window.location.reload()}
                          className={`flex-1 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[12px] transition-all active:scale-95 shadow-xl shadow-ios-blue/30 bg-ios-blue text-white`}
                        >
                          View Updates
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="py-12 flex flex-col items-center">
                      <LoadingSpinner size="large" />
                      <p className={`mt-6 text-sm font-black uppercase tracking-widest opacity-40 animate-pulse ${isDark ? 'text-white' : 'text-black'}`}>Securing Contribution...</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ContributeLocationModal;
