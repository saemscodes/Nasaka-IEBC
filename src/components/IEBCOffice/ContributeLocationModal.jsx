// src/components/IEBCOffice/ContributeLocationModal.jsx
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useContributeLocation } from '@/hooks/useContributeLocation';
import MapContainer from '@/components/IEBCOffice/MapContainer';
import UserLocationMarker from '@/components/IEBCOffice/UserLocationMarker';
import GeoJSONLayerManager from '@/components/IEBCOffice/GeoJSONLayerManager';
import LoadingSpinner from '@/components/IEBCOffice/LoadingSpinner';
import { supabase } from '@/integrations/supabase/client';
import L from 'leaflet';

// Complete list of 47 Kenyan counties with constituencies
const KENYAN_COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet",
  "Embu", "Garissa", "Homa Bay", "Isiolo", "Kajiado",
  "Kakamega", "Kericho", "Kiambu", "Kilifi", "Kirinyaga",
  "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia",
  "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit",
  "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi",
  "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua",
  "Nyeri", "Samburu", "Siaya", "Taita-Taveta", "Tana River",
  "Tharaka-Nithi", "Trans Nzoia", "Turkana", "Uasin Gishu",
  "Vihiga", "Wajir", "West Pokot"
];

// Comprehensive constituencies data from your database
const COUNTIES_DATA = [
  { id: 30, name: 'Nairobi', county_code: '047' },
  { id: 34, name: 'Nyamira', county_code: '046' },
  { id: 16, name: 'Kisii', county_code: '045' },
  { id: 27, name: 'Migori', county_code: '044' },
  { id: 8, name: 'Homa Bay', county_code: '043' },
  { id: 17, name: 'Kisumu', county_code: '042' },
  { id: 38, name: 'Siaya', county_code: '041' },
  { id: 4, name: 'Busia', county_code: '040' },
  { id: 3, name: 'Bungoma', county_code: '039' },
  { id: 45, name: 'Vihiga', county_code: '038' },
  { id: 11, name: 'Kakamega', county_code: '037' },
  { id: 2, name: 'Bomet', county_code: '036' },
  { id: 12, name: 'Kericho', county_code: '035' },
  { id: 10, name: 'Kajiado', county_code: '034' },
  { id: 33, name: 'Narok', county_code: '033' },
  { id: 31, name: 'Nakuru', county_code: '032' },
  { id: 20, name: 'Laikipia', county_code: '031' },
  { id: 1, name: 'Baringo', county_code: '030' },
  { id: 32, name: 'Nandi', county_code: '029' },
  { id: 5, name: 'Elgeyo/Marakwet', county_code: '028' },
  { id: 44, name: 'Uasin Gishu', county_code: '027' },
  { id: 42, name: 'Trans Nzoia', county_code: '026' },
  { id: 37, name: 'Samburu', county_code: '025' },
  { id: 47, name: 'West Pokot', county_code: '024' },
  { id: 43, name: 'Turkana', county_code: '023' },
  { id: 13, name: 'Kiambu', county_code: '022' },
  { id: 29, name: 'Murang\'a', county_code: '021' },
  { id: 15, name: 'Kirinyaga', county_code: '020' },
  { id: 36, name: 'Nyeri', county_code: '019' },
  { id: 35, name: 'Nyandarua', county_code: '018' },
  { id: 23, name: 'Makueni', county_code: '017' },
  { id: 22, name: 'Machakos', county_code: '016' },
  { id: 18, name: 'Kitui', county_code: '015' },
  { id: 6, name: 'Embu', county_code: '014' },
  { id: 41, name: 'Tharaka-Nithi', county_code: '013' },
  { id: 26, name: 'Meru', county_code: '012' },
  { id: 9, name: 'Isiolo', county_code: '011' },
  { id: 25, name: 'Marsabit', county_code: '010' },
  { id: 24, name: 'Mandera', county_code: '009' },
  { id: 46, name: 'Wajir', county_code: '008' },
  { id: 7, name: 'Garissa', county_code: '007' },
  { id: 39, name: 'Taita Taveta', county_code: '006' },
  { id: 21, name: 'Lamu', county_code: '005' },
  { id: 40, name: 'Tana River', county_code: '004' },
  { id: 14, name: 'Kilifi', county_code: '003' },
  { id: 19, name: 'Kwale', county_code: '002' },
  { id: 28, name: 'Mombasa', county_code: '001' }
];

const CONSTITUENCIES_DATA = [
  { id: 144, name: 'AINABKOI', county_id: 44 },
  { id: 190, name: 'AINAMOI', county_id: 12 },
  { id: 152, name: 'ALDAI', county_id: 32 },
  { id: 234, name: 'ALEGO USONGA', county_id: 38 },
  { id: 254, name: 'AWENDO', county_id: 27 },
  { id: 174, name: 'BAHATI', county_id: 31 },
  { id: 28, name: 'BALAMBALA', county_id: 7 },
  { id: 40, name: 'BANISSA', county_id: 24 },
  { id: 159, name: 'BARINGO CENTRAL', county_id: 1 },
  { id: 158, name: 'BARINGO NORTH', county_id: 1 },
  { id: 160, name: 'BARINGO SOUTH', county_id: 1 },
  { id: 192, name: 'BELGUT', county_id: 12 },
  { id: 264, name: 'BOBASI', county_id: 16 },
  { id: 263, name: 'BOMACHOGE BORABU', county_id: 16 },
  { id: 265, name: 'BOMACHOGE CHACHE', county_id: 16 },
  { id: 197, name: 'BOMET CENTRAL', county_id: 2 },
  { id: 196, name: 'BOMET EAST', county_id: 2 },
  { id: 261, name: 'BONCHARI', county_id: 16 },
  { id: 236, name: 'BONDO', county_id: 38 },
  { id: 273, name: 'BORABU', county_id: 34 },
  { id: 231, name: 'BUDALANGI', county_id: 4 },
  { id: 219, name: 'BUMULA', county_id: 3 },
  { id: 20, name: 'BURA', county_id: 40 },
  { id: 191, name: 'BURETI', county_id: 12 },
  { id: 207, name: 'BUTERE', county_id: 11 },
  { id: 229, name: 'BUTULA', county_id: 4 },
  { id: 57, name: 'BUURI', county_id: 26 },
  { id: 58, name: 'CENTRAL IMENTI', county_id: 26 },
  { id: 1, name: 'CHANGAMWE', county_id: 28 },
  { id: 195, name: 'CHEPALUNGU', county_id: 2 },
  { id: 140, name: 'CHERANGANY', county_id: 42 },
  { id: 154, name: 'CHESUMEI', county_id: 32 },
  { id: 61, name: 'CHUKA/IGAMBANG''OMBE', county_id: 41 },
  { id: 30, name: 'DADAAB', county_id: 7 },
  { id: 275, name: 'DAGORETTI NORTH', county_id: 30 },
  { id: 276, name: 'DAGORETTI SOUTH', county_id: 30 },
  { id: 162, name: 'ELDAMA RAVINE', county_id: 1 },
  { id: 37, name: 'ELDAS', county_id: 46 },
  { id: 284, name: 'EMBAKASI CENTRAL', county_id: 30 },
  { id: 285, name: 'EMBAKASI EAST', county_id: 30 },
  { id: 283, name: 'EMBAKASI NORTH', county_id: 30 },
  { id: 282, name: 'EMBAKASI SOUTH', county_id: 30 },
  { id: 286, name: 'EMBAKASI WEST', county_id: 30 },
  { id: 155, name: 'EMGWEN', county_id: 32 },
  { id: 215, name: 'EMUHAYA', county_id: 45 },
  { id: 178, name: 'EMURUA DIKIRR', county_id: 33 },
  { id: 137, name: 'ENDEBESS', county_id: 42 },
  { id: 31, name: 'FAFI', county_id: 7 },
  { id: 230, name: 'FUNYULA', county_id: 4 },
  { id: 19, name: 'GALOLE', county_id: 40 },
  { id: 15, name: 'GANZE', county_id: 14 },
  { id: 27, name: 'GARISSA TOWNSHIP', county_id: 7 },
  { id: 18, name: 'GARSEN', county_id: 40 },
  { id: 110, name: 'GATANGA', county_id: 29 },
  { id: 112, name: 'GATUNDU NORTH', county_id: 13 },
  { id: 111, name: 'GATUNDU SOUTH', county_id: 13 },
  { id: 235, name: 'GEM', county_id: 38 },
  { id: 101, name: 'GICHUGU', county_id: 15 },
  { id: 169, name: 'GILGIL', county_id: 31 },
  { id: 116, name: 'GITHUNGURI', county_id: 13 },
  { id: 213, name: 'HAMISI', county_id: 45 },
  { id: 249, name: 'HOMA BAY TOWN', county_id: 8 },
  { id: 52, name: 'IGEMBE CENTRAL', county_id: 26 },
  { id: 53, name: 'IGEMBE NORTH', county_id: 26 },
  { id: 51, name: 'IGEMBE SOUTH', county_id: 26 },
  { id: 32, name: 'IJARA', county_id: 7 },
  { id: 210, name: 'IKOLOMANI', county_id: 11 },
  { id: 49, name: 'ISIOLO NORTH', county_id: 9 },
  { id: 50, name: 'ISIOLO SOUTH', county_id: 9 },
  { id: 2, name: 'JOMVU', county_id: 28 },
  { id: 113, name: 'JUJA', county_id: 13 },
  { id: 119, name: 'KABETE', county_id: 13 },
  { id: 246, name: 'KABONDO KASIPUL', county_id: 8 },
  { id: 218, name: 'KABUCHAI', county_id: 3 },
  { id: 131, name: 'KACHELIBA', county_id: 47 },
  { id: 85, name: 'KAITI', county_id: 23 },
  { id: 184, name: 'KAJIADO CENTRAL', county_id: 10 },
  { id: 185, name: 'KAJIADO EAST', county_id: 10 },
  { id: 183, name: 'KAJIADO NORTH', county_id: 10 },
  { id: 187, name: 'KAJIADO SOUTH', county_id: 10 },
  { id: 186, name: 'KAJIADO WEST', county_id: 10 },
  { id: 13, name: 'KALOLENI', county_id: 14 },
  { id: 288, name: 'KAMUKUNJI', county_id: 30 },
  { id: 109, name: 'KANDARA', county_id: 29 },
  { id: 220, name: 'KANDUYI', county_id: 3 },
  { id: 104, name: 'KANGEMA', county_id: 29 },
  { id: 77, name: 'KANGUNDO', county_id: 22 },
  { id: 129, name: 'KAPENGURIA', county_id: 47 },
  { id: 145, name: 'KAPSERET', county_id: 44 },
  { id: 247, name: 'KARACHUONYO', county_id: 8 },
  { id: 280, name: 'KASARANI', county_id: 30 },
  { id: 245, name: 'KASIPUL', county_id: 8 },
  { id: 79, name: 'KATHIANI', county_id: 22 },
  { id: 149, name: 'KEIYO NORTH', county_id: 5 },
  { id: 150, name: 'KEIYO SOUTH', county_id: 5 },
  { id: 146, name: 'KESSES', county_id: 44 },
  { id: 208, name: 'KHWISERO', county_id: 11 },
  { id: 118, name: 'KIAMBAA', county_id: 13 },
  { id: 117, name: 'KIAMBU', county_id: 13 },
  { id: 278, name: 'KIBRA', county_id: 30 },
  { id: 88, name: 'KIBWEZI EAST', county_id: 23 },
  { id: 87, name: 'KIBWEZI WEST', county_id: 23 },
  { id: 95, name: 'KIENI', county_id: 36 },
  { id: 107, name: 'KIGUMO', county_id: 29 },
  { id: 106, name: 'KIHARU', county_id: 29 },
  { id: 120, name: 'KIKUYU', county_id: 13 },
  { id: 177, name: 'KILGORIS', county_id: 33 },
  { id: 11, name: 'KILIFI NORTH', county_id: 14 },
  { id: 12, name: 'KILIFI SOUTH', county_id: 14 },
  { id: 84, name: 'KILOME', county_id: 23 },
  { id: 223, name: 'KIMILILI', county_id: 3 },
  { id: 139, name: 'KIMININI', county_id: 42 },
  { id: 10, name: 'KINANGO', county_id: 19 },
  { id: 89, name: 'KINANGOP', county_id: 35 },
  { id: 90, name: 'KIPIPIRI', county_id: 35 },
  { id: 188, name: 'KIPKELION EAST', county_id: 12 },
  { id: 189, name: 'KIPKELION WEST', county_id: 12 },
  { id: 103, name: 'KIRINYAGA CENTRAL', county_id: 15 },
  { id: 3, name: 'KISAUNI', county_id: 28 },
  { id: 240, name: 'KISUMU CENTRAL', county_id: 17 },
  { id: 238, name: 'KISUMU EAST', county_id: 17 },
  { id: 239, name: 'KISUMU WEST', county_id: 17 },
  { id: 72, name: 'KITUI CENTRAL', county_id: 18 },
  { id: 73, name: 'KITUI EAST', county_id: 18 },
  { id: 71, name: 'KITUI RURAL', county_id: 18 },
  { id: 74, name: 'KITUI SOUTH', county_id: 18 },
  { id: 70, name: 'KITUI WEST', county_id: 18 },
  { id: 268, name: 'KITUTU CHACHE NORTH', county_id: 16 },
  { id: 269, name: 'KITUTU CHACHE SOUTH', county_id: 16 },
  { id: 270, name: 'KITUTU MASABA', county_id: 34 },
  { id: 198, name: 'KONOIN', county_id: 2 },
  { id: 171, name: 'KURESOI NORTH', county_id: 31 },
  { id: 170, name: 'KURESOI SOUTH', county_id: 31 },
  { id: 260, name: 'KURIA EAST', county_id: 27 },
  { id: 259, name: 'KURIA WEST', county_id: 27 },
  { id: 136, name: 'KWANZA', county_id: 42 },
  { id: 44, name: 'LAFEY', county_id: 24 },
  { id: 29, name: 'LAGDERA', county_id: 7 },
  { id: 164, name: 'LAIKIPIA EAST', county_id: 20 },
  { id: 165, name: 'LAIKIPIA NORTH', county_id: 20 },
  { id: 163, name: 'LAIKIPIA WEST', county_id: 20 },
  { id: 48, name: 'LAISAMIS', county_id: 25 },
  { id: 21, name: 'LAMU EAST', county_id: 21 },
  { id: 22, name: 'LAMU WEST', county_id: 21 },
  { id: 277, name: 'LANGATA', county_id: 30 },
  { id: 122, name: 'LARI', county_id: 13 },
  { id: 5, name: 'LIKONI', county_id: 28 },
  { id: 200, name: 'LIKUYANI', county_id: 11 },
  { id: 121, name: 'LIMURU', county_id: 13 },
  { id: 126, name: 'LOIMA', county_id: 43 },
  { id: 214, name: 'LUANDA', county_id: 45 },
  { id: 199, name: 'LUGARI', county_id: 11 },
  { id: 8, name: 'LUNGALUNGA', county_id: 19 },
  { id: 202, name: 'LURAMBI', county_id: 11 },
  { id: 60, name: 'MAARA', county_id: 41 },
  { id: 81, name: 'MACHAKOS TOWN', county_id: 22 },
  { id: 17, name: 'MAGARINI', county_id: 14 },
  { id: 287, name: 'MAKADARA', county_id: 30 },
  { id: 86, name: 'MAKUENI', county_id: 23 },
  { id: 201, name: 'MALAVA', county_id: 11 },
  { id: 16, name: 'MALINDI', county_id: 14 },
  { id: 43, name: 'MANDERA EAST', county_id: 24 },
  { id: 41, name: 'MANDERA NORTH', county_id: 24 },
  { id: 42, name: 'MANDERA SOUTH', county_id: 24 },
  { id: 39, name: 'MANDERA WEST', county_id: 24 },
  { id: 63, name: 'MANYATTA', county_id: 6 },
  { id: 108, name: 'MARAGWA', county_id: 29 },
  { id: 147, name: 'MARAKWET EAST', county_id: 5 },
  { id: 148, name: 'MARAKWET WEST', county_id: 5 },
  { id: 75, name: 'MASINGA', county_id: 22 },
  { id: 228, name: 'MATAYOS', county_id: 4 },
  { id: 290, name: 'MATHARE', county_id: 30 },
  { id: 105, name: 'MATHIOYA', county_id: 29 },
  { id: 96, name: 'MATHIRA', county_id: 36 },
  { id: 9, name: 'MATUGA', county_id: 19 },
  { id: 206, name: 'MATUNGU', county_id: 11 },
  { id: 78, name: 'MATUNGULU', county_id: 22 },
  { id: 80, name: 'MAVOKO', county_id: 22 },
  { id: 66, name: 'MBEERE NORTH', county_id: 6 },
  { id: 65, name: 'MBEERE SOUTH', county_id: 6 },
  { id: 83, name: 'MBOONI', county_id: 23 },
  { id: 161, name: 'MOGOTIO', county_id: 1 },
  { id: 143, name: 'MOIBEN', county_id: 44 },
  { id: 166, name: 'MOLO', county_id: 31 },
  { id: 156, name: 'MOSOP', county_id: 32 },
  { id: 45, name: 'MOYALE', county_id: 25 },
  { id: 7, name: 'MSAMBWENI', county_id: 19 },
  { id: 216, name: 'MT. ELGON', county_id: 3 },
  { id: 243, name: 'MUHORONI', county_id: 17 },
  { id: 98, name: 'MUKURWEINI', county_id: 36 },
  { id: 205, name: 'MUMIAS EAST', county_id: 11 },
  { id: 204, name: 'MUMIAS WEST', county_id: 11 },
  { id: 6, name: 'MVITA', county_id: 28 },
  { id: 82, name: 'MWALA', county_id: 22 },
  { id: 25, name: 'MWATATE', county_id: 39 },
  { id: 100, name: 'MWEA', county_id: 15 },
  { id: 69, name: 'MWINGI CENTRAL', county_id: 18 },
  { id: 67, name: 'MWINGI NORTH', county_id: 18 },
  { id: 68, name: 'MWINGI WEST', county_id: 18 },
  { id: 168, name: 'NAIVASHA', county_id: 31 },
  { id: 176, name: 'NAKURU TOWN EAST', county_id: 31 },
  { id: 175, name: 'NAKURU TOWN WEST', county_id: 31 },
  { id: 227, name: 'NAMBALE', county_id: 4 },
  { id: 153, name: 'NANDI HILLS', county_id: 32 },
  { id: 180, name: 'NAROK EAST', county_id: 33 },
  { id: 179, name: 'NAROK NORTH', county_id: 33 },
  { id: 181, name: 'NAROK SOUTH', county_id: 33 },
  { id: 182, name: 'NAROK WEST', county_id: 33 },
  { id: 203, name: 'NAVAKHOLO', county_id: 11 },
  { id: 93, name: 'NDARAGWA', county_id: 35 },
  { id: 250, name: 'NDHIWA', county_id: 8 },
  { id: 102, name: 'NDIA', county_id: 15 },
  { id: 167, name: 'NJORO', county_id: 31 },
  { id: 46, name: 'NORTH HORR', county_id: 25 },
  { id: 56, name: 'NORTH IMENTI', county_id: 26 },
  { id: 272, name: 'NORTH MUGIRANGO', county_id: 34 },
  { id: 244, name: 'NYAKACH', county_id: 17 },
  { id: 4, name: 'NYALI', county_id: 28 },
  { id: 242, name: 'NYANDO', county_id: 17 },
  { id: 267, name: 'NYARIBARI CHACHE', county_id: 16 },
  { id: 266, name: 'NYARIBARI MASABA', county_id: 16 },
  { id: 258, name: 'NYATIKE', county_id: 27 },
  { id: 99, name: 'NYERI TOWN', county_id: 36 },
  { id: 92, name: 'OL JOROK', county_id: 35 },
  { id: 91, name: 'OL KALOU', county_id: 35 },
  { id: 97, name: 'OTHAYA', county_id: 36 },
  { id: 132, name: 'POKOT SOUTH', county_id: 47 },
  { id: 14, name: 'RABAI', county_id: 14 },
  { id: 248, name: 'RANGWE', county_id: 8 },
  { id: 237, name: 'RARIEDA', county_id: 38 },
  { id: 173, name: 'RONGAI', county_id: 31 },
  { id: 253, name: 'RONGO', county_id: 27 },
  { id: 279, name: 'ROYSAMBU', county_id: 30 },
  { id: 281, name: 'RUARAKA', county_id: 30 },
  { id: 115, name: 'RUIRU', county_id: 13 },
  { id: 64, name: 'RUNYENJES', county_id: 6 },
  { id: 212, name: 'SABATIA', county_id: 45 },
  { id: 138, name: 'SABOTI', county_id: 42 },
  { id: 47, name: 'SAKU', county_id: 25 },
  { id: 135, name: 'SAMBURU EAST', county_id: 37 },
  { id: 134, name: 'SAMBURU NORTH', county_id: 37 },
  { id: 133, name: 'SAMBURU WEST', county_id: 37 },
  { id: 241, name: 'SEME', county_id: 17 },
  { id: 209, name: 'SHINYALU', county_id: 11 },
  { id: 130, name: 'SIGOR', county_id: 47 },
  { id: 193, name: 'SIGOWET/SOIN', county_id: 12 },
  { id: 217, name: 'SIRISIA', county_id: 3 },
  { id: 194, name: 'SOTIK', county_id: 2 },
  { id: 59, name: 'SOUTH IMENTI', county_id: 26 },
  { id: 262, name: 'SOUTH MUGIRANGO', county_id: 16 },
  { id: 141, name: 'SOY', county_id: 44 },
  { id: 289, name: 'STAREHE', county_id: 30 },
  { id: 251, name: 'SUBA NORTH', county_id: 8 },
  { id: 252, name: 'SUBA SOUTH', county_id: 8 },
  { id: 172, name: 'SUBUKIA', county_id: 31 },
  { id: 255, name: 'SUNA EAST', county_id: 27 },
  { id: 256, name: 'SUNA WEST', county_id: 27 },
  { id: 35, name: 'TARBAJ', county_id: 46 },
  { id: 23, name: 'TAVETA', county_id: 39 },
  { id: 225, name: 'TESO NORTH', county_id: 4 },
  { id: 226, name: 'TESO SOUTH', county_id: 4 },
  { id: 94, name: 'TETU', county_id: 36 },
  { id: 62, name: 'THARAKA', county_id: 41 },
  { id: 114, name: 'THIKA TOWN', county_id: 13 },
  { id: 157, name: 'TIATY', county_id: 1 },
  { id: 55, name: 'TIGANIA EAST', county_id: 26 },
  { id: 54, name: 'TIGANIA WEST', county_id: 26 },
  { id: 151, name: 'TINDERET', county_id: 32 },
  { id: 224, name: 'TONGAREN', county_id: 3 },
  { id: 142, name: 'TURBO', county_id: 44 },
  { id: 125, name: 'TURKANA CENTRAL', county_id: 43 },
  { id: 128, name: 'TURKANA EAST', county_id: 43 },
  { id: 123, name: 'TURKANA NORTH', county_id: 43 },
  { id: 127, name: 'TURKANA SOUTH', county_id: 43 },
  { id: 124, name: 'TURKANA WEST', county_id: 43 },
  { id: 232, name: 'UGENYA', county_id: 38 },
  { id: 233, name: 'UGUNJA', county_id: 38 },
  { id: 257, name: 'URIRI', county_id: 27 },
  { id: 211, name: 'VIHIGA', county_id: 45 },
  { id: 26, name: 'VOI', county_id: 39 },
  { id: 34, name: 'WAJIR EAST', county_id: 46 },
  { id: 33, name: 'WAJIR NORTH', county_id: 46 },
  { id: 38, name: 'WAJIR SOUTH', county_id: 46 },
  { id: 36, name: 'WAJIR WEST', county_id: 46 },
  { id: 221, name: 'WEBUYE EAST', county_id: 3 },
  { id: 222, name: 'WEBUYE WEST', county_id: 3 },
  { id: 271, name: 'WEST MUGIRANGO', county_id: 34 },
  { id: 274, name: 'WESTLANDS', county_id: 30 },
  { id: 24, name: 'WUNDANYI', county_id: 39 },
  { id: 76, name: 'YATTA', county_id: 22 }
];

// Generate CONSTITUENCY_SUGGESTIONS from the data
const CONSTITUENCY_SUGGESTIONS = {};
COUNTIES_DATA.forEach(county => {
  const constituencies = CONSTITUENCIES_DATA
    .filter(constituency => constituency.county_id === county.id)
    .map(constituency => constituency.name);
  CONSTITUENCY_SUGGESTIONS[county.name] = constituencies;
});

// Enhanced fuzzy search function
const fuzzySearch = (query, options, maxSuggestions = 5) => {
  if (!query) return [];
  
  const normalizedQuery = query.toLowerCase().trim();
  const words = normalizedQuery.split(/\s+/);
  
  const scores = options.map(option => {
    const normalizedOption = option.toLowerCase();
    let score = 0;
    
    // Exact match
    if (normalizedOption === normalizedQuery) {
      score += 100;
    }
    
    // Starts with query
    if (normalizedOption.startsWith(normalizedQuery)) {
      score += 50;
    }
    
    // Contains all words
    const containsAllWords = words.every(word => normalizedOption.includes(word));
    if (containsAllWords) {
      score += 30;
    }
    
    // Contains query as substring
    if (normalizedOption.includes(normalizedQuery)) {
      score += 20;
    }
    
    // Individual word matches
    words.forEach(word => {
      if (normalizedOption.includes(word)) {
        score += 10;
      }
    });
    
    return { option, score };
  });
  
  return scores
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions)
    .map(item => item.option);
};

// Enhanced constituency code mapping function
const getConstituencyCodeFromData = (constituencyName, countyName) => {
  if (!constituencyName || !countyName) return null;
  
  const normalizedConstituency = constituencyName.trim().toUpperCase();
  const normalizedCounty = countyName.trim().toUpperCase();
  
  // Find the county
  const county = COUNTIES_DATA.find(c => c.name.toUpperCase() === normalizedCounty);
  if (!county) {
    console.warn(`County not found: ${countyName}`);
    return null;
  }
  
  // Find the constituency within the county
  const constituency = CONSTITUENCIES_DATA.find(c => 
    c.county_id === county.id && c.name.toUpperCase() === normalizedConstituency
  );
  
  if (!constituency) {
    console.warn(`Constituency "${constituencyName}" not found in county "${countyName}"`);
    return null;
  }
  
  // Return the constituency ID as code
  return `CONST-${constituency.id}`;
};

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
    console.error('Error expanding URL:', error);
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

// Constituency validation function
const validateConstituencyCountyMatch = (constituencyName, countyName) => {
  if (!constituencyName || !countyName) return true;
  
  const normalizedConstituency = constituencyName.trim().toUpperCase();
  const normalizedCounty = countyName.trim().toUpperCase();
  
  const county = COUNTIES_DATA.find(c => c.name.toUpperCase() === normalizedCounty);
  if (!county) return false;
  
  const constituency = CONSTITUENCIES_DATA.find(c => 
    c.county_id === county.id && c.name.toUpperCase() === normalizedConstituency
  );
  
  return !!constituency;
};

// Enhanced status component for constituency validation
const ConstituencyStatus = ({ constituency, county, code }) => {
  if (!constituency || !county) return null;
  
  const isValidMatch = validateConstituencyCountyMatch(constituency, county);
  
  if (code) {
    return (
      <div className="mt-1">
        <p className="text-xs text-green-600">✓ Valid constituency: {constituency} in {county}</p>
        <p className="text-xs text-green-600">✓ Code: {code}</p>
      </div>
    );
  }
  
  if (!isValidMatch) {
    return (
      <div className="mt-1">
        <p className="text-xs text-red-600">⚠ "{constituency}" is not a valid constituency in {county}</p>
        <p className="text-xs text-gray-500 mt-1">Please select a valid constituency from the suggestions.</p>
      </div>
    );
  }
  
  return (
    <div className="mt-1">
      <p className="text-xs text-yellow-600">⚠ Constituency validated but code not available</p>
      <p className="text-xs text-gray-500 mt-1">This won't affect your submission. The constituency is valid.</p>
    </div>
  );
};

const ContributeLocationModal = ({ isOpen, onClose, onSuccess, userLocation }) => {
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
  
  // New state for fuzzy search
  const [countyInput, setCountyInput] = useState('');
  const [countySuggestions, setCountySuggestions] = useState([]);
  const [showCountySuggestions, setShowCountySuggestions] = useState(false);
  const [constituencyInput, setConstituencyInput] = useState('');
  const [constituencySuggestions, setConstituencySuggestions] = useState([]);
  const [showConstituencySuggestions, setShowConstituencySuggestions] = useState(false);
  
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
  
  const mapRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const markerRef = useRef(null);
  const fileInputRef = useRef(null);
  const countyInputRef = useRef(null);
  const constituencyInputRef = useRef(null);
  const retryCountRef = useRef(0);
  
  const { 
    getCurrentPosition, 
    convertImageToWebP, 
    submitContribution, 
    isSubmitting, 
    error
  } = useContributeLocation();

  // Enhanced constituency code fetching with local data fallback
  const fetchConstituencyCode = async (constituencyName, countyName) => {
    try {
      // Try local data first
      const code = getConstituencyCodeFromData(constituencyName, countyName);
      if (code) return code;
      
      // Fallback to database if needed
      const { data, error } = await supabase
        .rpc('get_constituency_code', { 
          constituency_name: constituencyName,
          county_name: countyName 
        });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.warn('Constituency code fetch failed, using fallback:', error);
      return getConstituencyCodeFromData(constituencyName, countyName);
    }
  };

  // Enhanced constituency suggestions with fuzzy search
  const enhancedConstituencySuggestions = useMemo(() => {
    if (!formData.submitted_county) return [];
    
    const baseSuggestions = CONSTITUENCY_SUGGESTIONS[formData.submitted_county] || [];
    
    // If user is typing, apply fuzzy search
    if (constituencyInput.trim()) {
      return fuzzySearch(constituencyInput, baseSuggestions, 10);
    }
    
    return baseSuggestions.slice(0, 10);
  }, [formData.submitted_county, constituencyInput]);

  // Enhanced county suggestions with fuzzy search
  const enhancedCountySuggestions = useMemo(() => {
    if (!countyInput.trim()) return KENYAN_COUNTIES.slice(0, 10);
    return fuzzySearch(countyInput, KENYAN_COUNTIES, 10);
  }, [countyInput]);

  // Enhanced: Auto-fetch constituency code when constituency and county are selected
  useEffect(() => {
    const fetchConstituencyCodeData = async () => {
      if (formData.submitted_constituency && formData.submitted_county) {
        try {
          console.log('Fetching constituency code for:', formData.submitted_constituency, formData.submitted_county);
          const code = await fetchConstituencyCode(formData.submitted_constituency, formData.submitted_county);
          setConstituencyCode(code);
          console.log('Constituency code found:', code);
        } catch (error) {
          console.warn('Failed to fetch constituency code:', error);
          setConstituencyCode(null);
        }
      } else {
        setConstituencyCode(null);
      }
    };

    const timeoutId = setTimeout(fetchConstituencyCodeData, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.submitted_constituency, formData.submitted_county]);

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

      const { data, error } = await supabase.rpc('find_duplicate_offices', {
        p_lat: lat,
        p_lng: lng,
        p_name: String(name || ''),
        p_radius_meters: Math.max(50, Math.min(radius, 1000))
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn('Safe duplicate check failed:', error.message);
      return [];
    }
  };

  // FIXED: Enhanced addMarkerToMap with proper retry limits
  const addMarkerToMap = useCallback((position, method = selectedMethod) => {
    if (!mapRef.current || !position || !position.lat || !position.lng) {
      console.warn('Cannot add marker: invalid position or map not ready');
      return;
    }

    if (isNaN(position.lat) || isNaN(position.lng)) {
      console.error('Invalid coordinates for marker:', position);
      return;
    }
    
    const addMarker = (retryCount = 0) => {
      if (retryCount > 3) {
        console.warn('Max retries exceeded for adding marker');
        return;
      }
      
      try {
        const mapInstance = mapRef.current;
        if (!mapInstance || typeof mapInstance.addLayer !== 'function') {
          console.warn('Map instance not ready for adding marker, retrying...');
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
        setDuplicateOffices(results.filter(office => office.is_likely_duplicate === true));
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

  // Auto-advance to details when position is set (for non-GPS methods)
  useEffect(() => {
    if (position && selectedMethod !== 'current_location' && step === 2) {
      const timer = setTimeout(() => {
        setStep(3);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [position, selectedMethod, step]);

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

  // Enhanced county selection handler with fuzzy search
  const handleCountySelect = (countyName) => {
    setFormData(prev => ({ ...prev, submitted_county: countyName }));
    setCountyInput(countyName);
    setShowCountySuggestions(false);
    
    // Clear constituency when county changes
    setFormData(prev => ({ ...prev, submitted_constituency: '' }));
    setConstituencyInput('');
  };

  // Enhanced constituency selection handler
  const handleConstituencySelect = (constituencyName) => {
    setFormData(prev => ({ ...prev, submitted_constituency: constituencyName }));
    setConstituencyInput(constituencyName);
    setShowConstituencySuggestions(false);
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
        if (limitedAccuracy > 100) {
          setLocationError({
            type: 'warning',
            message: `GPS accuracy is low (±${Math.round(limitedAccuracy)}m). Please move to an open area or manually adjust the pin.`,
            action: {
              label: 'Adjust Pin Manually',
              onClick: () => setSelectedMethod('drop_pin')
            }
          });
        } else if (limitedAccuracy <= 20) {
          setLocationError({
            type: 'success', 
            message: `✓ Good accuracy (±${Math.round(limitedAccuracy)}m). You're within the recommended 20m range.`
          });
        }
      } else {
        console.warn('Map ref not available for location update');
      }

      // AUTO-PROCEED TO STEP 3: Wait a moment then automatically proceed to office details
      setTimeout(() => {
        setStep(3);
      }, 1500);
      
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
      const contributionData = {
        submitted_latitude: position.lat,
        submitted_longitude: position.lng,
        submitted_accuracy_meters: accuracy || 50,
        submitted_office_location: formData.submitted_office_location,
        submitted_county: formData.submitted_county,
        submitted_constituency: formData.submitted_constituency,
        submitted_constituency_code: constituencyCode,
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
          constituency_code: constituencyCode
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
    setCountySuggestions([]);
    setShowCountySuggestions(false);
    setConstituencyInput('');
    setConstituencySuggestions([]);
    setShowConstituencySuggestions(false);
    setAgreement(false);
    setLocationError(null);
    setSubmissionSuccess(false);
    setContributionId(null);
    setDuplicateOffices([]);
    setConstituencyCode(null);
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

  // Suggestion dropdown components
  const CountySuggestionsDropdown = () => {
    if (!showCountySuggestions || enhancedCountySuggestions.length === 0) return null;
    
    return (
      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
        {enhancedCountySuggestions.map((county, index) => (
          <button
            key={index}
            type="button"
            className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
            onClick={() => handleCountySelect(county)}
          >
            {county}
          </button>
        ))}
      </div>
    );
  };

  const ConstituencySuggestionsDropdown = () => {
    if (!showConstituencySuggestions || enhancedConstituencySuggestions.length === 0) return null;
    
    return (
      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
        {enhancedConstituencySuggestions.map((constituency, index) => (
          <button
            key={index}
            type="button"
            className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
            onClick={() => handleConstituencySelect(constituency)}
          >
            {constituency}
          </button>
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col"
          >
            {/* Header with progress indicator */}
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  {step === 1 && 'Contribute IEBC Office Location'}
                  {step === 2 && 'Capture Location'}
                  {step === 3 && 'Office Details'}
                  {step === 4 && 'Submission Complete'}
                </h2>
                {/* Progress indicator */}
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4].map((stepNum) => (
                    <div
                      key={stepNum}
                      className={`w-2 h-2 rounded-full ${
                        stepNum === step ? 'bg-green-600' : 
                        stepNum < step ? 'bg-green-400' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
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
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">How would you like to contribute?</h3>
                    <p className="text-gray-600">Choose your preferred method to capture the IEBC office location</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <button
                      onClick={() => handleMethodSelect('current_location')}
                      className="p-4 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all text-left focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                      aria-label="Use my current location"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">Use My Current Location</h4>
                          <p className="text-sm text-gray-600">Stand at the IEBC office and capture your GPS coordinates</p>
                          <p className="text-xs text-green-600 mt-1">✓ Most accurate method</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleMethodSelect('drop_pin')}
                      className="p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      aria-label="Drop a pin on map"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">Drop a Pin on Map</h4>
                          <p className="text-sm text-gray-600">Manually place a pin on the exact office location</p>
                          <p className="text-xs text-blue-600 mt-1">✓ Good for precise placement</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleMethodSelect('google_maps')}
                      className="p-4 border-2 border-gray-200 rounded-xl hover:border-red-500 hover:bg-red-50 transition-all text-left focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                      aria-label="Paste Google Maps link"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">Paste Google Maps Link</h4>
                          <p className="text-sm text-gray-600">Share a Google Maps URL or coordinates</p>
                          <p className="text-xs text-red-600 mt-1">✓ Quick and convenient</p>
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
                              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                ✓ Good Accuracy
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
                          <p className="text-sm text-green-700">
                            ✓ Coordinates extracted: {parseResult.lat.toFixed(6)}, {parseResult.lng.toFixed(6)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Map Preview */}
                  {(selectedMethod === 'current_location' || selectedMethod === 'drop_pin' || parseResult) && (
                    <div className="h-64 rounded-lg overflow-hidden border border-gray-300 bg-gray-100">
                      <MapContainer
                        center={mapCenter}
                        zoom={mapZoom}
                        className="h-full w-full"
                        onMapReady={handleMapReady}
                        onClick={handleMapClick}
                        isModalMap={true}
                        ref={mapRef}
                      >
                        <GeoJSONLayerManager
                          activeLayers={['iebc-offices']}
                          onOfficeSelect={() => {}}
                          selectedOffice={null}
                          onNearbyOfficesFound={() => {}}
                          baseMap="standard"
                          isModalMap={true}
                        />
                        {userLocation && (
                          <UserLocationMarker
                            position={[userLocation.latitude, userLocation.longitude]}
                            accuracy={Math.min(userLocation.accuracy, 1000)}
                          />
                        )}
                        {position && (
                          <UserLocationMarker
                            position={[position.lat, position.lng]}
                            accuracy={accuracy}
                            color="#34C759"
                          />
                        )}
                      </MapContainer>
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

                  <div className="flex space-x-3 pt-4">
                    <button
                      onClick={() => setStep(1)}
                      className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      disabled={!position || isGettingLocation}
                      className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                    >
                      {isGettingLocation ? (
                        <div className="flex items-center justify-center space-x-2">
                          <LoadingSpinner size="small" />
                          <span>Getting Location...</span>
                        </div>
                      ) : (
                        'Continue to Details'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Office Details Form */}
              {step === 3 && (
                <form onSubmit={handleFormSubmit} className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Office Information</h3>
                    <p className="text-gray-600">Provide details about the IEBC office</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label htmlFor="office-name" className="block text-sm font-medium text-gray-700 mb-1">
                        Office Name *
                      </label>
                      <input
                        id="office-name"
                        type="text"
                        required
                        value={formData.submitted_office_location}
                        onChange={(e) => setFormData(prev => ({ ...prev, submitted_office_location: e.target.value }))}
                        placeholder="e.g., IEBC Eldoret County Office"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative">
                        <label htmlFor="county" className="block text-sm font-medium text-gray-700 mb-1">
                          County *
                        </label>
                        <input
                          id="county"
                          ref={countyInputRef}
                          type="text"
                          required
                          value={countyInput}
                          onChange={(e) => {
                            setCountyInput(e.target.value);
                            setShowCountySuggestions(true);
                            if (e.target.value !== formData.submitted_county) {
                              setFormData(prev => ({ ...prev, submitted_county: e.target.value }));
                            }
                          }}
                          onFocus={() => setShowCountySuggestions(true)}
                          onBlur={() => setTimeout(() => setShowCountySuggestions(false), 200)}
                          placeholder="e.g., Nairobi"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                        />
                        <CountySuggestionsDropdown />
                        {countyInput && !formData.submitted_county && (
                          <p className="text-xs text-gray-500 mt-1">
                            Type to search counties. Suggestions will appear below.
                          </p>
                        )}
                      </div>

                      <div className="relative">
                        <label htmlFor="constituency" className="block text-sm font-medium text-gray-700 mb-1">
                          Constituency *
                        </label>
                        <input
                          id="constituency"
                          ref={constituencyInputRef}
                          type="text"
                          required
                          value={constituencyInput}
                          onChange={(e) => {
                            setConstituencyInput(e.target.value);
                            setShowConstituencySuggestions(true);
                            if (e.target.value !== formData.submitted_constituency) {
                              setFormData(prev => ({ ...prev, submitted_constituency: e.target.value }));
                            }
                          }}
                          onFocus={() => setShowConstituencySuggestions(true)}
                          onBlur={() => setTimeout(() => setShowConstituencySuggestions(false), 200)}
                          placeholder="e.g., Westlands"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                          disabled={!formData.submitted_county}
                        />
                        <ConstituencySuggestionsDropdown />
                        {!formData.submitted_county && (
                          <p className="text-xs text-gray-500 mt-1">Please select a county first</p>
                        )}
                        
                        {/* Enhanced constituency status */}
                        <ConstituencyStatus 
                          constituency={formData.submitted_constituency}
                          county={formData.submitted_county}
                          code={constituencyCode}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="landmark" className="block text-sm font-medium text-gray-700 mb-1">
                        Nearby Landmark (Optional)
                      </label>
                      <input
                        id="landmark"
                        type="text"
                        value={formData.submitted_landmark}
                        onChange={(e) => setFormData(prev => ({ ...prev, submitted_landmark: e.target.value }))}
                        placeholder="e.g., Next to Eldoret Post Office"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Photo of the Office (Optional but Recommended)
                      </label>
                      <div className="flex items-center space-x-4">
                        <label className="flex-1 cursor-pointer">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleImageSelect}
                            className="hidden"
                          />
                          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-gray-400 transition-colors">
                            <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-sm text-gray-600">
                              {imageFile ? 'Photo selected' : 'Take or upload a photo'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Supports JPEG, PNG, WEBP (max 10MB)</p>
                          </div>
                        </label>
                        {imagePreview && (
                          <div className="flex-shrink-0 relative">
                            <img src={imagePreview} alt="Office preview" className="w-20 h-20 object-cover rounded-lg" />
                            <button
                              type="button"
                              onClick={handleRemoveImage}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                              aria-label="Remove photo"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        📸 Photos with GPS data are prioritized for fast verification
                      </p>
                    </div>

                    <div>
                      <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                        Additional Notes (Optional)
                      </label>
                      <textarea
                        id="notes"
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any landmarks, building details, or other information..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                      />
                    </div>

                    <div className="flex items-start space-x-3">
                      <input
                        id="agreement"
                        type="checkbox"
                        required
                        checked={agreement}
                        onChange={(e) => setAgreement(e.target.checked)}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500 mt-1"
                      />
                      <label htmlFor="agreement" className="text-sm text-gray-700">
                        I confirm this is the correct location of an IEBC office and consent to submitting my approximate location for public benefit
                      </label>
                    </div>
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={!agreement || isSubmitting}
                      className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center justify-center space-x-2">
                          <LoadingSpinner size="small" />
                          <span>Submitting...</span>
                        </div>
                      ) : (
                        'Submit Contribution'
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Step 4: Submission Complete */}
              {step === 4 && (
                <div className="text-center space-y-6">
                  {submissionSuccess ? (
                    <>
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Contribution Successfully Submitted!</h3>
                        <p className="text-gray-600 mb-4">Your location data has been submitted and is now in our moderation queue.</p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                        <p className="text-sm text-green-700 text-left">
                          <strong className="block mb-2">What happens next:</strong>
                          <span className="block mb-1">✓ Your submission enters our moderation queue</span>
                          <span className="block mb-1">✓ Our team will verify the location data for accuracy</span>
                          <span className="block mb-1">✓ Once approved, it will be added to the official database</span>
                          <span className="block">✓ You'll be helping thousands of Kenyans find accurate IEBC office locations</span>
                        </p>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                        <p className="text-sm text-blue-700 text-left">
                          <strong className="block mb-1">Contribution ID: #{contributionId}</strong>
                          <span>Keep this reference number for any inquiries about your submission.</span>
                          {constituencyCode && (
                            <span className="block mt-1">
                              <strong>Constituency Code:</strong> {constituencyCode}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex space-x-3 pt-2">
                        <button
                          onClick={handleClose}
                          className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                        >
                          Continue Browsing
                        </button>
                        <button
                          onClick={() => window.location.reload()}
                          className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                        >
                          Reload Map & See Updates
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="py-8">
                      <LoadingSpinner size="large" />
                      <p className="text-gray-600 mt-4">Processing your contribution...</p>
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
