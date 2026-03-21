// src/components/IEBCOffice/OfficeBottomSheet.jsx
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { calculateDistance } from '@/utils/geoUtils';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  buildUrlsFor,
  openWithAppFallback,
  getProviderColors,
  trackProviderOpen,
  UBER_PRODUCTS
} from '@/utils/rideLinks';
import {
  calculateAllFares,
  getCheapestOption,
  formatFare,
  estimateTravelTime,
  getCurrentTrafficCondition,
  getTrafficInfo,
  FARE_DISCLAIMER
} from '@/utils/kenyaFareCalculator';
import {
  getOfficeDisplayName,
  getOfficeLandmark,
  getOfficeLandmarkDistance,
} from '@/utils/officeNameNormalizer';
import UberModal from './UberModal';
import i18next from 'i18next';
import { useNavigate } from 'react-router-dom';
import { slugify } from '@/components/SEO/SEOHead';

// === INTERNAL SVG COMPONENTS ===
const IconSun = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.5" />
    <path d="M12 2V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M12 21V22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M22 12L21 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M3 12L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path opacity="0.5" d="M19.0708 4.92969L18.678 5.32252" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path opacity="0.5" d="M5.32178 18.6777L4.92894 19.0706" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path opacity="0.5" d="M19.0708 19.0703L18.678 18.6775" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path opacity="0.5" d="M5.32178 5.32227L4.92894 4.92943" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const IconCar = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <g id="Page-1" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
      <g id="Dribbble-Light-Preview" transform="translate(-140.000000, -5479.000000)" fill="currentColor">
        <g id="icons" transform="translate(56.000000, 160.000000)">
          <path d="M89,5335 L89,5335 C88.448,5335 88,5334.552 88,5334 C88,5333.448 88.448,5333 89,5333 C89.552,5333 90,5333.448 90,5334 C90,5334.552 89.552,5335 89,5335 M99,5333 L99,5333 C99.552,5333 100,5333.448 100,5334 C100,5334.552 99.552,5335 99,5335 C98.448,5335 98,5334.552 98,5334 C98,5333.448 98.448,5333 99,5333 M90.602,5321 L97.398,5321 C97.896,5321 98.318,5321.366 98.388,5321.859 L99.694,5331 L88.306,5331 L89.612,5321.859 C89.682,5321.366 90.104,5321 90.602,5321 M104,5328 L104,5328 C104,5327.448 103.552,5327 103,5327 L101.143,5327 L100.245,5320.717 C100.105,5319.732 99.261,5319 98.265,5319 L89.735,5319 C88.739,5319 87.895,5319.732 87.755,5320.717 L86.857,5327 L85,5327 C84.448,5327 84,5327.448 84,5328 C84,5328.552 84.448,5329 85,5329 L86.571,5329 L86.286,5331 L86,5331 C84.895,5331 84,5331.895 84,5333 L84,5335 C84,5336.105 84.895,5337 86,5337 L86,5338 C86,5338.552 86.448,5339 87,5339 L89,5339 C89.552,5339 90,5338.552 90,5338 L90,5337 L98,5337 L98,5338 C98,5338.552 98.448,5339 99,5339 L101,5339 C101.552,5339 102,5338.552 102,5338 L102,5337 C103.105,5337 104,5336.105 104,5335 L104,5333 C104,5331.895 103.105,5331 102,5331 L101.714,5331 L101.429,5329 L103,5329 C103.552,5329 104,5328.552 104,5328" id="car_front_view-[#616]"></path>
        </g>
      </g>
    </g>
  </svg>
);

const IconPin = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
    <path d="M 28.0117 52.8203 C 28.9492 52.8203 30.1679 49.0703 30.1679 42.1328 L 30.1679 20.5703 C 33.9883 19.6094 36.8008 16.1406 36.8008 12.0156 C 36.8008 7.1641 32.8867 3.1797 28.0117 3.1797 C 23.1133 3.1797 19.1992 7.1641 19.1992 12.0156 C 19.1992 16.1172 22.0117 19.5859 25.8086 20.5703 L 25.8086 42.1328 C 25.8086 49.0469 27.0508 52.8203 28.0117 52.8203 Z M 25.4805 12.5078 C 23.8867 12.5078 22.4805 11.1016 22.4805 9.4609 C 22.4805 7.8437 23.8867 6.4609 25.4805 6.4609 C 27.1445 6.4609 28.4805 7.8437 28.4805 9.4609 C 28.4805 11.1016 27.1445 12.5078 25.4805 12.5078 Z" />
  </svg>
);

const IconWallet = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M21.1009 8.00353C21.0442 7.99996 20.9825 7.99998 20.9186 8L20.9026 8.00001H18.3941C16.3264 8.00001 14.5572 9.62757 14.5572 11.75C14.5572 13.8724 16.3264 15.5 18.3941 15.5H20.9026L20.9186 15.5C20.9825 15.5 21.0442 15.5001 21.1009 15.4965C21.9408 15.4434 22.6835 14.7862 22.746 13.8682C22.7501 13.808 22.75 13.7431 22.75 13.683L22.75 13.6667V9.83334L22.75 9.81702C22.75 9.75688 22.7501 9.69199 22.746 9.6318C22.6835 8.71381 21.9408 8.05657 21.1009 8.00353ZM18.1717 12.75C18.704 12.75 19.1355 12.3023 19.1355 11.75C19.1355 11.1977 18.704 10.75 18.1717 10.75C17.6394 10.75 17.2078 11.1977 17.2078 11.75C17.2078 12.3023 17.6394 12.75 18.1717 12.75Z" fill="currentColor" />
    <path fillRule="evenodd" clipRule="evenodd" d="M20.9179 17C21.067 16.9961 21.1799 17.1342 21.1394 17.2778C20.9387 17.9902 20.62 18.5975 20.1088 19.1088C19.3604 19.8571 18.4114 20.1892 17.239 20.3469C16.0998 20.5 14.6442 20.5 12.8064 20.5H10.6936C8.85583 20.5 7.40019 20.5 6.26098 20.3469C5.08856 20.1892 4.13961 19.8571 3.39124 19.1088C2.64288 18.3604 2.31076 17.4114 2.15314 16.239C1.99997 15.0998 1.99998 13.6442 2 11.8064V11.6936C1.99998 9.85583 1.99997 8.40019 2.15314 7.26098C2.31076 6.08856 2.64288 5.13961 3.39124 4.39124C4.13961 3.64288 5.08856 3.31076 6.26098 3.15314C7.40019 2.99997 8.85582 2.99998 10.6936 3L12.8064 3C14.6442 2.99998 16.0998 2.99997 17.239 3.15314C18.4114 3.31076 19.3604 3.64288 20.1088 4.39124C20.62 4.90252 20.9386 5.50974 21.1394 6.22218C21.1799 6.36575 21.067 6.50387 20.9179 6.5L18.394 6.50001C15.5574 6.50001 13.0571 8.74091 13.0571 11.75C13.0571 14.7591 15.5574 17 18.394 17L20.9179 17ZM5.75 7C5.33579 7 5 7.33579 5 7.75C5 8.16421 5.33579 8.5 5.75 8.5H9.75C10.1642 8.5 10.5 8.16421 10.5 7.75C10.5 7.33579 10.1642 7 9.75 7H5.75Z" fill="currentColor" />
  </svg>
);

const IconRain = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <g>
      <path fill="currentColor" d="M227.746,480.465c0,7.799,3.162,14.92,8.25,20.006c5.084,5.084,12.205,8.25,20.004,8.25 c15.707,0,28.252-12.66,28.252-28.256v-62.772h-56.506V480.465z" />
      <path fill="currentColor" d="M0,266.902c16.392-6.127,36.713-9.74,58.709-9.74c35.981,0,67.455,9.74,84.688,24.195 c7.227-86.468,28.49-173.302,63.215-216.562C103.488,84.486,21.84,164.617,0,266.902z" />
      <path fill="currentColor" d="M277.394,24.658c0-11.715-9.576-21.379-21.379-21.379c-11.715,0-21.379,9.664-21.379,21.379V73.06 c-28.219,26.082-56.268,101.08-65.162,209.942c13.426-12.314,37.113-21.465,65.162-24.543v139.133h42.758V258.459 c28.137,3.164,51.824,12.229,65.25,24.629c-8.98-108.864-37.029-183.946-65.25-210.028V24.658z" />
      <path fill="currentColor" d="M305.543,64.795c34.619,43.26,55.883,130.094,63.112,216.51c17.23-14.455,48.654-24.143,84.635-24.143 c21.943,0,42.316,3.613,58.711,9.74C490.158,164.668,408.562,84.537,305.543,64.795z" />
    </g>
  </svg>
);

const IconCompass = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15.94 7.61999L11.06 9.61999C10.7251 9.75225 10.421 9.95185 10.1664 10.2064C9.91185 10.461 9.71225 10.7651 9.57999 11.1L7.57999 15.98C7.54715 16.0636 7.54869 16.1567 7.58429 16.2392C7.61988 16.3216 7.68664 16.3866 7.76999 16.42C7.85065 16.4499 7.93934 16.4499 8.02 16.42L12.9 14.42C13.2348 14.2877 13.539 14.0881 13.7936 13.8336C14.0481 13.579 14.2477 13.2748 14.38 12.94L16.38 8.05999C16.4128 7.97643 16.4113 7.88326 16.3757 7.80082C16.3401 7.71839 16.2733 7.65338 16.19 7.61999C16.1093 7.59013 16.0207 7.59013 15.94 7.61999ZM12 13C11.8022 13 11.6089 12.9413 11.4444 12.8315C11.28 12.7216 11.1518 12.5654 11.0761 12.3827C11.0004 12.2 10.9806 11.9989 11.0192 11.8049C11.0578 11.6109 11.153 11.4327 11.2929 11.2929C11.4327 11.153 11.6109 11.0578 11.8049 11.0192C11.9989 10.9806 12.2 11.0004 12.3827 11.0761C12.5654 11.1518 12.7216 11.28 12.8315 11.4444C12.9413 11.6089 13 11.8022 13 12C13 12.2652 12.8946 12.5196 12.7071 12.7071C12.5196 12.8946 12.2652 13 12 13Z" fill="currentColor" />
    <path d="M12 21C10.22 21 8.47991 20.4722 6.99987 19.4832C5.51983 18.4943 4.36628 17.0887 3.68509 15.4442C3.0039 13.7996 2.82567 11.99 3.17294 10.2442C3.5202 8.49836 4.37737 6.89472 5.63604 5.63604C6.89472 4.37737 8.49836 3.5202 10.2442 3.17294C11.99 2.82567 13.7996 3.0039 15.4442 3.68509C17.0887 4.36628 18.4943 5.51983 19.4832 6.99987C20.4722 8.47991 21 10.22 21 12C21 14.387 20.0518 16.6761 18.364 18.364C16.6761 20.0518 14.387 21 12 21ZM12 4.5C10.5166 4.5 9.0666 4.93987 7.83323 5.76398C6.59986 6.58809 5.63856 7.75943 5.07091 9.12988C4.50325 10.5003 4.35473 12.0083 4.64411 13.4632C4.9335 14.918 5.64781 16.2544 6.6967 17.3033C7.7456 18.3522 9.08197 19.0665 10.5368 19.3559C11.9917 19.6453 13.4997 19.4968 14.8701 18.9291C16.2406 18.3614 17.4119 17.4001 18.236 16.1668C19.0601 14.9334 19.5 13.4834 19.5 12C19.5 10.0109 18.7098 8.10323 17.3033 6.6967C15.8968 5.29018 13.9891 4.5 12 4.5Z" fill="currentColor" />
  </svg>
);

const IconWindy = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
    <path fill="currentColor" d="m 4 1 c -0.554688 0 -1 0.445312 -1 1 s 0.445312 1 1 1 h 1 c 0.074219 0.003906 0.144531 0.027344 0.214844 0.066406 c 0.199218 0.113282 0.289062 0.339844 0.230468 0.566406 c -0.058593 0.222657 -0.25 0.367188 -0.476562 0.367188 h -4.96875 v 2 h 4.96875 c 1.125 0 2.121094 -0.765625 2.410156 -1.855469 c 0.289063 -1.085937 -0.1875 -2.246093 -1.160156 -2.808593 c -0.320312 -0.183594 -0.671875 -0.285157 -1.023438 -0.316407 c -0.003906 0 -0.007812 0 -0.011718 -0.003906 c -0.0625 -0.007813 -0.121094 -0.015625 -0.183594 -0.015625 z m 8.480469 1 c -1.617188 0.011719 -3.058594 1.152344 -3.40625 2.769531 c -0.113281 0.542969 0.230469 1.074219 0.773437 1.1875 c 0.539063 0.117188 1.070313 -0.230469 1.183594 -0.769531 c 0.167969 -0.78125 0.886719 -1.285156 1.675781 -1.171875 c 0.792969 0.109375 1.34375 0.792969 1.289063 1.589844 c -0.054688 0.796875 -0.699219 1.394531 -1.496094 1.394531 h -12.5 v 2 h 12.5 c 1.828125 0 3.363281 -1.429688 3.492188 -3.253906 c 0.128906 -1.828125 -1.195313 -3.457032 -3.003907 -3.714844 c -0.171875 -0.023438 -0.339843 -0.03125 -0.507812 -0.03125 z m -12.480469 8 v 2 h 10 c 0.289062 0 0.5 0.210938 0.5 0.5 s -0.210938 0.5 -0.5 0.5 h -1 c -0.554688 0 -1 0.445312 -1 1 s 0.445312 1 1 1 h 1 c 1.367188 0 2.5 -1.132812 2.5 -2.5 s -1.132812 -2.5 -2.5 -2.5 z m 0 0" />
  </svg>
);

const IconPhone = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.0376 5.31617L10.6866 6.4791C11.2723 7.52858 11.0372 8.90532 10.1147 9.8278C10.1147 9.8278 10.1147 9.8278 10.1147 9.8278C10.1146 9.82792 8.99588 10.9468 11.0245 12.9755C13.0525 15.0035 14.1714 13.8861 14.1722 13.8853C14.1722 13.8853 14.1722 13.8853 14.1722 13.8853C15.0947 12.9628 16.4714 12.7277 17.5209 13.3134L18.6838 13.9624C20.2686 14.8468 20.4557 17.0692 19.0628 18.4622C18.2258 19.2992 17.2004 19.9505 16.0669 19.9934C14.1588 20.0658 10.9183 19.5829 7.6677 16.3323C4.41713 13.0817 3.93421 9.84122 4.00655 7.93309C4.04952 6.7996 4.7008 5.77423 5.53781 4.93723C6.93076 3.54428 9.15317 3.73144 10.0376 5.31617Z" fill="currentColor" />
  </svg>
);

const IconMotorcycle = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 511.99 511.99" xmlns="http://www.w3.org/2000/svg">
    <g><path fill="currentColor" d="M95.998,242.668c-1.461,0-2.914-0.312-4.273-0.906l-42.671-18.657 c-3.883-1.703-6.391-5.531-6.391-9.781v-28.796c0-5.891,4.781-10.672,10.672-10.672s10.664,4.781,10.664,10.672l71.483,23.952 c5.625-1.75,11.609,1.375,13.367,7c1.75,5.625-1.383,11.609-7,13.359l-42.671,13.344C98.139,242.496,97.068,242.668,95.998,242.668 z" /></g>
    <path fill="currentColor" d="M148.481,317.446c-0.312,0-0.617,0-0.93-0.031c-5.875-0.516-10.218-5.672-9.71-11.545l5.765-66.796 c0.508-5.859,5.672-10.203,11.547-9.703c5.867,0.5,10.21,5.672,9.703,11.547l-5.765,66.78 C158.614,313.259,153.958,317.446,148.481,317.446z" />
    <g><path fill="currentColor" d="M85.334,261.323C38.28,261.323,0,299.604,0,346.665c0,47.047,38.28,85.326,85.334,85.326 c47.046,0,85.326-38.279,85.326-85.326C170.661,299.604,132.38,261.323,85.334,261.323z" />
      <path fill="currentColor" d="M426.647,261.323c-47.029,0-85.311,38.281-85.311,85.342c0,47.047,38.281,85.326,85.311,85.326 c47.062,0,85.343-38.279,85.343-85.326C511.99,299.604,473.71,261.323,426.647,261.323z" /></g>
    <path fill="currentColor" d="M85.342,357.321c-3.539,0-7-1.75-9.031-4.969c-3.141-4.984-1.656-11.562,3.328-14.719l101.326-63.998 c4.984-3.141,11.57-1.656,14.718,3.328c3.141,4.984,1.656,11.578-3.328,14.719L91.029,355.681 C89.256,356.79,87.287,357.321,85.342,357.321z" />
    <path fill="currentColor" d="M309.338,314.665H202.66c-3.352,0-6.516-1.594-8.531-4.266l-62.202-82.95L28.038,185.903 c-4.75-1.906-7.484-6.906-6.516-11.922s5.359-8.656,10.477-8.656h254.527l73.139-20.608c5.484-1.531,11.203,1.484,13.016,6.891 l7.031,21.015c0.859,2.594,0.688,5.438-0.469,7.922l-60.266,127.996C317.212,312.274,313.463,314.665,309.338,314.665z" />
    <path fill="currentColor" d="M426.647,357.337c-4.469,0-8.625-2.828-10.108-7.297l-82.89-248.713h-24.312 c-5.906,0-10.688-4.766-10.688-10.656s4.781-10.672,10.688-10.672h31.999c4.578,0,8.656,2.938,10.109,7.297l85.326,255.994 c1.875,5.578-1.156,11.625-6.75,13.484C428.913,357.149,427.772,357.337,426.647,357.337z" />
  </svg>
);

const IconUsers = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 -26.28 122.88 122.88" xmlns="http://www.w3.org/2000/svg">
    <path fill="currentColor" d="M29.34,41.02c-12.27,0-18.31,10.91-15.43,22.31L5.5,63.33C1.89,61.72,0.39,58.4,0,54.17v-6.96 c0-5.68,0-11.36,0-17.52c0-4.74,3.02-7.11,9.1-7.11l4.35,0L22.2,4.35C23.41,1.45,25.61,0,28.72,0h16.93v0.1h69.13 c5.16,0.05,7.96,2.51,8.11,7.68v55.55h-6.98c4.2-10.86-3.59-22.27-15.12-22.27c-11.55,0-19.35,11.4-15.14,22.27H45.39 C47.53,52.59,41.3,41.02,29.34,41.02L29.34,41.02z M41.26,57.74c0,3.47-1.15,6.44-3.49,8.89c-2.32,2.45-5.14,3.69-8.43,3.69 c-3.32,0-6.14-1.24-8.46-3.69c-2.32-2.45-3.49-5.42-3.49-8.89c0-3.47,1.17-6.44,3.49-8.89c2.32-2.47,5.14-3.69,8.46-3.69 c3.29,0,6.11,1.21,8.43,3.69C40.11,51.3,41.26,54.28,41.26,57.74L41.26,57.74z M112.61,57.74c0,3.47-1.15,6.44-3.49,8.89 c-2.32,2.45-5.14,3.69-8.43,3.69c-3.32,0-6.14-1.24-8.46-3.69c-2.32-2.45-3.49-5.42-3.49-8.89c0-3.47,1.17-6.44,3.49-8.89 c2.32-2.47,5.14-3.69,8.46-3.69c3.29,0,6.11,1.21,8.43,3.69C111.46,51.3,112.61,54.28,112.61,57.74L112.61,57.74z M100.67,53.74 c2.21,0,4,1.79,4,4c0,2.21-1.79,4-4,4c-2.21,0-4-1.79-4-4C96.67,55.53,98.46,53.74,100.67,53.74L100.67,53.74z M29.32,53.74 c2.21,0,4,1.79,4,4c0,2.21-1.79,4-4,4c-2.21,0-4-1.79-4-4C25.32,55.53,27.11,53.74,29.32,53.74L29.32,53.74z M52.54,8.05h15.08 v20.07H52.54V8.05L52.54,8.05z M37.62,32.16h6.21v1.7h-6.21V32.16L37.62,32.16z M43.83,28.12V8.05H28.76l-7.97,20.07H43.83 L43.83,28.12L43.83,28.12z M99.61,8.05h15.08v20.07H99.61V8.05L99.61,8.05z M76.55,8.05h15.08v20.07H76.55V8.05L76.55,8.05z" />
  </svg>
);

const IconSparkles = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
    <path d="M466.963,233.298c-0.194-0.647-0.26-1.295-0.455-1.942c-5.633-22.539-19.234-43.007-38.406-59.652 c-19.82-17.294-45.727-30.507-75.197-37.761c-16.774-4.209-34.715-6.476-53.369-6.476c-18.652,0-36.594,2.268-53.369,6.476 c-38.018,9.392-70.08,28.628-90.871,53.757c-10.881,13.084-18.652,27.786-22.668,43.396h-3.238 c-4.34,0-151.428,11.464-126.559,119.822h68.59c-0.064-1.167-0.129-2.332-0.129-3.497c0-3.433,0.324-6.866,0.842-9.845 c4.793-27.073,28.238-46.763,55.766-46.763s50.973,19.69,55.701,46.568c0.584,3.173,0.906,6.606,0.906,10.04 c0,1.049-0.059,2.098-0.115,3.149c-0.012,0.032-0.004,0.078-0.014,0.11h0.008c-0.004,0.08-0.004,0.159-0.008,0.238h144.045 c-0.064-1.167-0.129-2.332-0.129-3.497c0-3.433,0.324-6.866,0.842-9.845c4.793-27.073,28.24-46.763,55.766-46.763 c27.527,0,50.972,19.69,55.701,46.503c0.584,3.238,0.906,6.672,0.906,10.105c0,1.045-0.058,2.09-0.115,3.137 c-0.01,0.035-0.002,0.087-0.014,0.122h0.01c-0.006,0.08-0.006,0.159-0.01,0.238h56.719c7.629,0,13.816-6.203,13.844-13.831 C512.213,263.339,513.328,250.078,466.963,233.298z" />
  </svg>
);

const IconBolt = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 111.9 65" xmlns="http://www.w3.org/2000/svg">
    <path fill="currentColor" d="M30.4,23c4.4-7.1,2.2-16.4-4.8-20.8C23.2,0.8,20.5,0,17.7,0H0v48.9h19.9c8.3,0,15-6.8,15-15.1 C34.9,29.7,33.3,25.9,30.4,23z M11.4,11.5h6.3c2,0,3.6,1.6,3.6,3.6c0,2-1.6,3.6-3.6,3.6h-6.3V11.5z M19.9,37.4h-8.5v-7.2h8.5 c2,0,3.6,1.6,3.6,3.6C23.5,35.8,21.9,37.4,19.9,37.4z M90,0v48.9H78.6V2.4L90,0z M56.8,13.9c-9.7,0-17.6,7.9-17.6,17.7 c0,9.8,7.9,17.7,17.6,17.7c9.7,0,17.6-7.9,17.6-17.7C74.3,21.8,66.5,13.9,56.8,13.9z M56.8,37.4c-3.2,0-5.7-2.6-5.7-5.7 c0-3.2,2.5-5.7,5.7-5.7c3.2,0,5.7,2.6,5.7,5.7C62.5,34.8,59.9,37.4,56.8,37.4z M62.5,59.3c0,3.2-2.6,5.7-5.7,5.7 c-3.1,0-5.7-2.6-5.7-5.7c0-3.2,2.6-5.7,5.7-5.7C59.9,53.5,62.5,56.1,62.5,59.3z M111.8,14.5V26h-5.7v9c0,2.7,0.9,4.7,3.2,4.7 c0.9,0,1.7-0.1,2.5-0.3v8.5c-1.7,0.9-3.6,1.4-5.6,1.4h-0.1c-0.1,0-0.1,0-0.2,0c-0.1,0-0.1,0-0.2,0h-0.1l-0.2,0 C99.1,49,94.7,45,94.7,37.9v0v0V26V8.2l11.4-2.4v8.8H111.8z" />
  </svg>
);

const IconGoogleMaps = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 11.9556C2 8.47078 2 6.7284 2.67818 5.39739C3.27473 4.22661 4.22661 3.27473 5.39739 2.67818C6.7284 2 8.47078 2 11.9556 2H20.0444C23.5292 2 25.2716 2 26.6026 2.67818C27.7734 3.27473 28.7253 4.22661 29.3218 5.39739C30 6.7284 30 8.47078 30 11.9556V20.0444C30 23.5292 30 25.2716 29.3218 26.6026C28.7253 27.7734 27.7734 28.7253 26.6026 29.3218C25.2716 30 23.5292 30 20.0444 30H11.9556C8.47078 30 6.7284 30 5.39739 29.3218C4.22661 28.7253 3.27473 27.7734 2.67818 26.6026C2 25.2716 2 23.5292 2 20.0444V11.9556Z" fill="white" />
    <path fillRule="evenodd" clipRule="evenodd" d="M24 12.8116L23.9999 12.8541C23.9998 12.872 23.9996 12.8899 23.9994 12.9078C23.9998 12.9287 24 12.9498 24 12.971C24 16.3073 21.4007 19.2604 19.6614 21.2367C19.1567 21.8101 18.7244 22.3013 18.449 22.6957C17.4694 24.0986 16.9524 25.6184 16.8163 26.2029C16.8163 26.6431 16.4509 27 16 27C15.5491 27 15.1837 26.6431 15.1837 26.2029C15.0476 25.6184 14.5306 24.0986 13.551 22.6957C13.2756 22.3013 12.8433 21.8101 12.3386 21.2367C10.5993 19.2604 8 16.3073 8 12.971C8 12.9498 8.0002 12.9287 8.0006 12.9078C8.0002 12.8758 8 12.8437 8 12.8116C8 8.49736 11.5817 5 16 5C20.4183 5 24 8.49736 24 12.8116ZM16 15.6812C17.7132 15.6812 19.102 14.325 19.102 12.6522C19.102 10.9793 17.7132 9.62319 16 9.62319C14.2868 9.62319 12.898 10.9793 12.898 12.6522C12.898 14.325 14.2868 15.6812 16 15.6812Z" fill="#34A851" />
    <path d="M23.1054 9.21856C22.1258 7.37546 20.4161 5.96177 18.3504 5.34277L13.7559 10.5615C14.3208 9.98352 15.1174 9.62346 16.0002 9.62346C17.7134 9.62346 19.1022 10.9796 19.1022 12.6524C19.1022 13.3349 18.8711 13.9646 18.4811 14.4711L23.1054 9.21856Z" fill="#4285F5" />
    <path d="M12.4311 21.3425C12.4004 21.3076 12.3695 21.2725 12.3383 21.2371C11.1918 19.9344 9.67162 18.2073 8.76855 16.2257L13.5439 10.8018C13.1387 11.3136 12.8976 11.9556 12.8976 12.6526C12.8976 14.3254 14.2865 15.6816 15.9997 15.6816C16.8675 15.6816 17.6521 15.3336 18.2151 14.7727L12.4311 21.3425Z" fill="#F9BB0E" />
    <path d="M9.89288 7.76562C8.71207 9.12685 8 10.8881 8 12.8117C8 12.8438 8.0002 12.8759 8.0006 12.9079C8.0002 12.9288 8 12.9499 8 12.9711C8 14.1082 8.30196 15.2009 8.76889 16.2254L13.5362 10.8106L9.89288 7.76562Z" fill="#E74335" />
    <path d="M18.3499 5.34254C17.6068 5.11988 16.8176 5 15.9997 5C13.5514 5 11.36 6.07387 9.89258 7.76553L13.5359 10.8105L13.5438 10.8015C13.6101 10.7178 13.6807 10.6375 13.7554 10.5611L18.3499 5.34254Z" fill="#1A73E6" />
  </svg>
);

const IconAppleMaps = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="-1.5 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <g id="Page-1" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
      <g id="Dribbble-Light-Preview" transform="translate(-102.000000, -7439.000000)" fill="currentColor">
        <g id="icons" transform="translate(56.000000, 160.000000)">
          <path d="M57.5708873,7282.19296 C58.2999598,7281.34797 58.7914012,7280.17098 58.6569121,7279 C57.6062792,7279.04 56.3352055,7279.67099 55.5818643,7280.51498 C54.905374,7281.26397 54.3148354,7282.46095 54.4735932,7283.60894 C55.6455696,7283.69593 56.8418148,7283.03894 57.5708873,7282.19296 M60.1989864,7289.62485 C60.2283111,7292.65181 62.9696641,7293.65879 63,7293.67179 C62.9777537,7293.74279 62.562152,7295.10677 61.5560117,7296.51675 C60.6853718,7297.73474 59.7823735,7298.94772 58.3596204,7298.97372 C56.9621472,7298.99872 56.5121648,7298.17973 54.9134635,7298.17973 C53.3157735,7298.17973 52.8162425,7298.94772 51.4935978,7298.99872 C50.1203933,7299.04772 49.0738052,7297.68074 48.197098,7296.46676 C46.4032359,7293.98379 45.0330649,7289.44985 46.8734421,7286.3899 C47.7875635,7284.87092 49.4206455,7283.90793 51.1942837,7283.88393 C52.5422083,7283.85893 53.8153044,7284.75292 54.6394294,7284.75292 C55.4635543,7284.75292 57.0106846,7283.67793 58.6366882,7283.83593 C59.3172232,7283.86293 61.2283842,7284.09893 62.4549652,7285.8199 C62.355868,7285.8789 60.1747177,7287.09489 60.1989864,7289.62485" id="apple-[#173]"></path>
        </g>
      </g>
    </g>
  </svg>
);

const IconUber = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 926.906 321.777" xmlns="http://www.w3.org/2000/svg">
    <g>
      <path fill="currentColor" d="M53.328,229.809c3.917,10.395,9.34,19.283,16.27,26.664c6.93,7.382,15.14,13.031,24.63,16.948 c9.491,3.917,19.81,5.875,30.958,5.875c10.847,0,21.015-2.034,30.506-6.102s17.776-9.792,24.856-17.173 c7.08-7.382,12.579-16.194,16.496-26.438c3.917-10.244,5.875-21.692,5.875-34.347V0h47.453v316.354h-47.001v-29.376 c-10.545,11.147-22.974,19.734-37.285,25.761c-14.312,6.025-29.752,9.038-46.323,9.038c-16.873,0-32.615-2.938-47.228-8.813 c-14.612-5.875-27.267-14.235-37.962-25.082S15.441,264.006,9.265,248.79C3.088,233.575,0,216.628,0,197.947V0h47.453v195.236 C47.453,207.891,49.411,219.414,53.328,229.809z" />
      <path fill="currentColor" d="M332.168,0v115.243c10.545-10.545,22.748-18.905,36.607-25.082s28.924-9.265,45.193-9.265 c16.873,0,32.689,3.163,47.453,9.49c14.763,6.327,27.567,14.914,38.414,25.761s19.434,23.651,25.761,38.414 c6.327,14.764,9.49,30.431,9.49,47.002c0,16.57-3.163,32.162-9.49,46.774c-6.327,14.613-14.914,27.343-25.761,38.188 c-10.847,10.847-23.651,19.434-38.414,25.761c-14.764,6.327-30.581,9.49-47.453,9.49c-16.27,0-31.409-3.088-45.419-9.265 c-14.01-6.176-26.288-14.537-36.833-25.082v28.924h-45.193V0H332.168z M337.365,232.746c4.067,9.642,9.717,18.078,16.948,25.309 c7.231,7.231,15.667,12.956,25.308,17.174c9.642,4.218,20.036,6.327,31.184,6.327c10.847,0,21.09-2.109,30.731-6.327 s18.001-9.942,25.083-17.174c7.08-7.23,12.729-15.667,16.947-25.309c4.218-9.641,6.327-20.035,6.327-31.183 c0-11.148-2.109-21.618-6.327-31.41s-9.867-18.303-16.947-25.534c-7.081-7.23-15.441-12.88-25.083-16.947 s-19.885-6.102-30.731-6.102c-10.846,0-21.09,2.034-30.731,6.102s-18.077,9.717-25.309,16.947 c-7.23,7.231-12.955,15.742-17.173,25.534c-4.218,9.792-6.327,20.262-6.327,31.41C331.264,212.711,333.298,223.105,337.365,232.746 z" />
      <path fill="currentColor" d="M560.842,155.014c6.025-14.462,14.312-27.191,24.856-38.188s23.049-19.659,37.511-25.986 s30.129-9.49,47.001-9.49c16.571,0,31.937,3.013,46.098,9.038c14.16,6.026,26.362,14.387,36.606,25.083 c10.244,10.695,18.229,23.35,23.952,37.962c5.725,14.613,8.587,30.506,8.587,47.68v14.914H597.901 c1.507,9.34,4.52,18.002,9.039,25.985c4.52,7.984,10.168,14.914,16.947,20.789c6.779,5.876,14.462,10.471,23.049,13.784 c8.587,3.314,17.7,4.972,27.342,4.972c27.418,0,49.563-11.299,66.435-33.896l32.991,24.404 c-11.449,15.366-25.609,27.418-42.481,36.155c-16.873,8.737-35.854,13.106-56.944,13.106c-17.174,0-33.217-3.014-48.131-9.039 s-27.869-14.462-38.866-25.309s-19.659-23.576-25.986-38.188s-9.491-30.506-9.491-47.679 C551.803,184.842,554.817,169.476,560.842,155.014z M624.339,137.162c-12.805,10.696-21.316,24.932-25.534,42.708h140.552 c-3.917-17.776-12.278-32.012-25.083-42.708c-12.805-10.695-27.794-16.043-44.967-16.043 C652.133,121.119,637.144,126.467,624.339,137.162z" />
      <path fill="currentColor" d="M870.866,142.359c-9.641,10.545-14.462,24.856-14.462,42.934v131.062h-45.646V85.868h45.193v28.472 c5.725-9.34,13.182-16.722,22.371-22.145c9.189-5.424,20.111-8.136,32.766-8.136h15.817v42.482h-18.981 C892.86,126.542,880.507,131.814,870.866,142.359z" />
    </g>
  </svg>
);

const IconCopy = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 11C6 8.17157 6 6.75736 6.87868 5.87868C7.75736 5 9.17157 5 12 5H15C17.8284 5 19.2426 5 20.1213 5.87868C21 6.75736 21 8.17157 21 11V16C21 18.8284 21 20.2426 20.1213 21.1213C19.2426 22 17.8284 22 15 22H12C9.17157 22 7.75736 22 6.87868 21.1213C6 20.2426 6 18.8284 6 16V11Z" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 19C4.34315 19 3 17.6569 3 16V10C3 6.22876 3 4.34315 4.17157 3.17157C5.34315 2 7.22876 2 11 2H15C16.6569 2 18 3.34315 18 5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const renderIcon = (icon, className = "w-4 h-4") => {
  if (!icon) return null;
  if (typeof icon !== 'string') return icon;

  const slug = icon.toLowerCase().trim();

  switch (slug) {
    case 'car':
    case '🚗':
      return <IconCar className={className} />;
    case 'bolt':
    case '⚡':
      return <IconBolt className={className} />;
    case 'wallet':
    case '💰':
      return <IconWallet className={className} />;
    case 'pin':
    case '📍':
      return <IconPin className={className} />;
    case 'phone':
    case '📞':
      return <IconPhone className={className} />;
    case 'sun':
    case '☀️':
      return <IconSun className={className} />;
    case 'rain':
    case '🌧️':
      return <IconRain className={className} />;
    case 'windy':
    case '💨':
      return <IconWindy className={className} />;
    case 'compass':
      return <IconCompass className={className} />;
    case 'motorcycle':
    case 'motorbike':
      return <IconMotorcycle className={className} />;
    case 'users':
    case 'van':
      return <IconUsers className={className} />;
    case 'sparkles':
    case 'premium':
    case 'vip':
      return <IconSparkles className={className} />;
    default:
      if (icon.length <= 2) return <span>{icon}</span>;
      return null;
  }
};

const OfficeBottomSheet = ({
  office,
  userLocation,
  currentRoute,
  routingError,
  travelInsights,
  state = 'peek',
  onExpand,
  onCollapse,
  onClose,
  hasLocationAccess = false,
  isDiaspora: isDiasporaProp
}) => {
  const isDiaspora = isDiasporaProp ?? (office?.type === 'diaspora' || office?.designation_state !== undefined);
  const navigate = useNavigate();
  const [dragY, setDragY] = useState(0);
  const [showUberModal, setShowUberModal] = useState(false);
  const [showFareDetails, setShowFareDetails] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsingForModal, setIsCollapsingForModal] = useState(false);
  const dragControls = useDragControls();
  const sheetRef = useRef(null);
  const backdropRef = useRef(null);
  const { theme } = useTheme();
  const { t } = useTranslation('nasaka');
  const isDark = theme === 'dark';

  // Handle backdrop click to minimize
  const handleBackdropClick = (e) => {
    if (e.target === backdropRef.current && state === 'expanded' && !showUberModal) {
      onCollapse?.();
    }
  };

  // Handle escape key to minimize
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && state === 'expanded' && !showUberModal) {
        onCollapse?.();
      }
    };
    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [state, showUberModal, onCollapse]);

  // Calculate distance to office - ONLY if we have location access
  const distanceToOffice = useMemo(() => {
    if (!hasLocationAccess || !office || !userLocation?.latitude || !userLocation?.longitude) {
      return null;
    }
    return calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      office.latitude,
      office.longitude
    );
  }, [hasLocationAccess, office, userLocation]);

  // Calculate fare estimates - ONLY if we have location access and NOT diaspora
  const fareEstimates = useMemo(() => {
    if (!hasLocationAccess || !distanceToOffice || isDiaspora) return null;

    const estimatedMinutes = currentRoute?.[0]?.summary?.totalTime
      ? Math.round(currentRoute[0].summary.totalTime / 60)
      : estimateTravelTime(distanceToOffice);

    return calculateAllFares(distanceToOffice, estimatedMinutes, 'nairobi');
  }, [hasLocationAccess, distanceToOffice, currentRoute]);

  // Get cheapest option - ONLY if we have location access
  const cheapestFare = useMemo(() => {
    if (!hasLocationAccess || !fareEstimates) return null;
    return getCheapestOption(fareEstimates);
  }, [hasLocationAccess, fareEstimates]);

  // Get traffic condition - ONLY if we have location access
  const trafficInfo = hasLocationAccess ? getTrafficInfo() : null;

  // Handle drag end
  const handleDragEnd = (event, info) => {
    setIsDragging(false);
    const threshold = 100;

    if (info.offset.y > threshold) {
      if (state === 'expanded') {
        onCollapse?.();
      } else {
        onClose?.();
      }
    } else if (info.offset.y < -threshold && state === 'peek') {
      onExpand?.();
    }

    setDragY(0);
  };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  // Coordinates setup - pickup only available if location access granted
  const coordsAvailable = office && office.latitude != null && office.longitude != null;
  const pickup = hasLocationAccess && userLocation && userLocation.latitude != null && userLocation.longitude != null
    ? { lat: userLocation.latitude, lng: userLocation.longitude }
    : null;
  const destination = coordsAvailable
    ? { latitude: office.latitude, longitude: office.longitude }
    : null;

  // Provider opener functions - conditional based on location access
  const openProvider = (provider, productType = null) => {
    const urls = buildUrlsFor(provider, {
      pickup: hasLocationAccess ? pickup : null,
      destination,
      productType
    });
    openWithAppFallback(urls.app, urls.web);
    trackProviderOpen(provider, {
      productType,
      source: 'bottom_sheet',
      hasLocationAccess,
      hasPickup: !!pickup,
      hasDestination: !!destination
    });
  };

  const openUber = (productType = null) => {
    // If we have a product type, open directly (from modal selection)
    if (productType) {
      openProvider('uber', productType);
      setShowUberModal(false);
      return;
    }

    // If we're in expanded state and need to show modal, collapse first with smooth animation
    if (state === 'expanded' && hasLocationAccess && fareEstimates) {
      setIsCollapsingForModal(true);
      onCollapse?.();

      // Wait for collapse animation to complete before showing modal
      setTimeout(() => {
        setShowUberModal(true);
        setIsCollapsingForModal(false);
      }, 350); // Match the spring animation duration
    } else {
      // If already peeked or no location access, open directly or show modal immediately
      if (!hasLocationAccess || !fareEstimates) {
        openProvider('uber');
      } else {
        setShowUberModal(true);
      }
    }
  };

  const openBolt = () => openProvider('bolt');
  const openGoogleMaps = () => openProvider('google');
  const openAppleMaps = () => openProvider('apple');

  // Copy coordinates
  const copyCoords = async () => {
    if (!coordsAvailable) return;
    const coords = `${office.latitude},${office.longitude}`;
    try {
      await navigator.clipboard.writeText(coords);
      alert(t('bottomSheet.coordinatesCopied', 'Coordinates copied to clipboard!'));
    } catch (err) {
      const fallback = prompt(t('bottomSheet.copyCoordinatesPrompt', 'Copy coordinates:'), coords);
      if (fallback !== null) {
        try { await navigator.clipboard.writeText(coords); } catch (_) { }
      }
    }
  };

  // Handle tap on peek area
  const handlePeekTap = () => {
    if (state === 'peek' && !isDragging) {
      onExpand?.();
    }
  };

  if (!office && state === 'hidden') return null;

  // Get provider colors
  const googleColors = getProviderColors('google', isDark);
  const appleColors = getProviderColors('apple', isDark);
  const uberColors = getProviderColors('uber', isDark);
  const boltColors = getProviderColors('bolt', isDark);

  return (
    <>
      {/* Backdrop for tapping outside - Only when expanded and no modal open */}
      <AnimatePresence>
        {state === 'expanded' && !showUberModal && (
          <motion.div
            ref={backdropRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="office-bottom-sheet-backdrop active backdrop-transition"
            onClick={handleBackdropClick}
            style={{ cursor: 'pointer' }}
          />
        )}
      </AnimatePresence>

      {/* Main Bottom Sheet */}
      <AnimatePresence>
        {office && state !== 'hidden' && (
          <motion.div
            ref={sheetRef}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            initial={{ y: '100%' }}
            animate={{
              y: state === 'peek' ? 'calc(100% - 80px)' : 0,
              transition: {
                type: 'spring',
                stiffness: 400,
                damping: 40
              }
            }}
            exit={{ y: '100%' }}
            className={`office-bottom-sheet ${state} ${isDark
              ? 'bg-card border-border text-foreground md:border-ios-gray-600'
              : 'bg-white border-ios-gray-200 text-ios-gray-900'
              } md:left-auto md:right-6 md:bottom-6 md:w-[400px] md:max-h-[85vh] md:rounded-[32px] md:border shadow-2xl transition-colors duration-300`}
            style={{ y: dragY }}
          >
            {/* Drag Handle */}
            <div
              className={`bottom-sheet-handle ${isDark ? 'bg-ios-gray-400' : 'bg-ios-gray-300'
                } transition-colors duration-300`}
              onPointerDown={e => dragControls.start(e)}
            />

            {/* Peek Preview */}
            <div className="px-5 py-3 cursor-pointer" onClick={handlePeekTap}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className={`font-semibold text-lg line-clamp-1 transition-colors duration-300 ${isDark ? 'text-white' : 'text-foreground'
                    }`}>
                    {isDiaspora
                      ? (office.mission_name || t('office.diasporaTitle', 'Diaspora Centre'))
                      : (office.office_name || office.constituency_name || t('office.officeName', 'IEBC Office'))
                    }
                  </h3>
                  {(() => {
                    const dn = getOfficeDisplayName(office);
                    const cn = (office.constituency_name || '').toLowerCase();
                    return dn && dn.toLowerCase() !== cn && dn !== 'IEBC Office' ? (
                      <p className={`text-xs font-medium mt-0.5 line-clamp-1 transition-colors duration-300 ${isDark ? 'text-ios-blue-400' : 'text-primary'
                        }`}>
                        <IconPin className="w-3 h-3 inline-block mr-1" />
                        {dn}
                      </p>
                    ) : null;
                  })()}
                  <p className={`text-sm mt-1 line-clamp-1 transition-colors duration-300 ${isDark ? 'text-ios-gray-300' : 'text-muted-foreground'
                    }`}>
                    {isDiaspora
                      ? `${office.city}, ${office.country}`
                      : (office.constituency_name && office.county
                        ? `${office.constituency_name}, ${office.county}`
                        : office.county || office.constituency_name || t('office.location', 'Location'))
                    }
                  </p>
                </div>

                {/* Show distance and fare ONLY if we have location access */}
                {hasLocationAccess && distanceToOffice && (
                  <div className="ml-4 text-right">
                    <span className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-ios-blue-400' : 'text-primary'
                      }`}>
                      {t('office.distance', { distance: distanceToOffice.toFixed(1) })}
                    </span>
                    {cheapestFare && (
                      <p className={`text-xs mt-1 font-semibold transition-colors duration-300 ${isDark ? 'text-green-400' : 'text-green-600'
                        }`}>
                        {formatFare(cheapestFare.total)}
                      </p>
                    )}
                  </div>
                )}
                {/* Show different message when no location access */}
                {!hasLocationAccess && (
                  <div className="ml-4 text-right">
                    <span className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-ios-blue-400' : 'text-primary'
                      }`}>
                      {t('office.tapForDirections', 'Tap for directions')}
                    </span>
                    <p className={`text-xs mt-1 transition-colors duration-300 ${isDark ? 'text-ios-gray-400' : 'text-muted-foreground'
                      }`}>
                      {t('office.noLocationAccess', 'No location access')}
                    </p>
                  </div>
                )}
              </div>

              {/* QUICK GLANCE WEATHER/TRAFFIC (USER REQUEST) */}
              {hasLocationAccess && (travelInsights || trafficInfo) && (
                <div className={`mt-2 flex items-center space-x-3 px-1 animate-fade-in`}>
                  {travelInsights && (
                    <div className="flex items-center space-x-1">
                      <IconSun className="w-3.5 h-3.5" />
                      <span className={`text-[11px] font-bold ${isDark ? 'text-ios-gray-300' : 'text-gray-600'}`}>
                        {travelInsights.weatherDesc} • {travelInsights.temperature}°C
                      </span>
                    </div>
                  )}
                  {trafficInfo && (
                    <div className="flex items-center space-x-1">
                      <IconCar className="w-3.5 h-3.5" />
                      <span className={`text-[11px] font-bold ${trafficInfo.color || ''}`}>
                        {trafficInfo.description}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Expanded Content */}
            {state === 'expanded' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.1 }}
                className="bottom-sheet-content green-scrollbar"
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div className={`border-b pb-4 transition-colors duration-300 ${isDark ? 'border-ios-gray-600' : 'border-border'
                    }`}>
                    <h2 className={`text-2xl font-bold transition-colors duration-300 ${isDark ? 'text-white' : 'text-foreground'
                      }`}>
                      {office.office_name || office.constituency_name || t('office.officeName', 'IEBC Office')}
                    </h2>
                    {(() => {
                      const dn = getOfficeDisplayName(office);
                      const cn = (office.constituency_name || '').toLowerCase();
                      return dn && dn.toLowerCase() !== cn && dn !== 'IEBC Office' ? (
                        <p className={`text-sm font-medium mt-1 transition-colors duration-300 ${isDark ? 'text-ios-blue-400' : 'text-primary'
                          }`}>
                          <IconPin className="w-4 h-4 inline-block mr-1" />
                          {dn}
                        </p>
                      ) : null;
                    })()}
                    {(() => {
                      const lm = getOfficeLandmark(office);
                      const dist = getOfficeLandmarkDistance(office);
                      return lm ? (
                        <p className={`text-xs mt-1 transition-colors duration-300 ${isDark ? 'text-ios-gray-400' : 'text-muted-foreground'
                          }`}>
                          <IconCompass className="w-4 h-4 inline-block mr-1" />
                          {t('office.nearLandmark', 'Near')}: {lm}{dist && dist !== 'On-site' ? ` (${dist})` : dist === 'On-site' ? ' — On-site' : ''}
                        </p>
                      ) : null;
                    })()}
                    {office.office_type && (
                      <span className={`inline-block mt-2 px-3 py-1 text-xs font-medium rounded-full transition-colors duration-300 ${isDark
                        ? 'bg-ios-blue/30 text-ios-blue-400'
                        : 'bg-primary/20 text-primary'
                        }`}>
                        {office.office_type}
                      </span>
                    )}
                    {isDiaspora && (
                      <span className={`inline-block mt-2 px-3 py-1 text-xs font-medium rounded-full transition-colors duration-300 ${isDark
                        ? 'bg-purple-900/30 text-purple-400'
                        : 'bg-purple-100 text-purple-700'
                        }`}>
                        {t('office.diasporaBadge', 'Diaspora Registration Centre')}
                      </span>
                    )}
                  </div>

                  {/* LOCATION ACCESS WARNING - SHOW WHEN NO ACCESS */}
                  {!hasLocationAccess && (
                    <div className={`rounded-xl p-4 border transition-colors duration-300 ${isDark
                      ? 'bg-yellow-900/20 border-yellow-700/30'
                      : 'bg-yellow-50 border-yellow-200'
                      }`}>
                      <div className="flex items-start space-x-3">
                        <IconPin className="w-5 h-5 mt-0.5" />
                        <div className="flex-1">
                          <h4 className={`text-sm font-semibold mb-1 ${isDark ? 'text-yellow-300' : 'text-yellow-800'
                            }`}>
                            {t('bottomSheet.locationAccessRequired', 'Location Access Required')}
                          </h4>
                          <p className={`text-xs ${isDark ? 'text-yellow-200' : 'text-yellow-700'
                            }`}>
                            {t('bottomSheet.locationAccessDesc', 'Enable location access to see fare estimates, get directions from your current location, and find the nearest route to this office.')}
                          </p>
                          <button
                            onClick={() => window.location.reload()}
                            className={`mt-2 text-xs px-3 py-1 rounded-full font-medium transition-colors ${isDark
                              ? 'bg-yellow-700 hover:bg-yellow-600 text-white'
                              : 'bg-yellow-200 hover:bg-yellow-300 text-yellow-900'
                              }`}
                          >
                            {t('bottomSheet.enableLocationAccess', 'Enable Location Access')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* FARE ESTIMATES CARD - ONLY SHOW IF LOCATION ACCESS GRANTED AND NOT DIASPORA */}
                  {hasLocationAccess && fareEstimates && !isDiaspora && (
                    <div className={`rounded-xl p-4 border transition-colors duration-300 ${isDark
                      ? 'bg-gradient-to-br from-green-900/20 to-blue-900/20 border-green-700/30'
                      : 'bg-gradient-to-br from-green-50 to-blue-50 border-green-200'
                      }`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <IconWallet className="w-5 h-5" />
                          <div>
                            <h4 className={`text-sm font-semibold ${isDark ? 'text-green-300' : 'text-green-800'
                              }`}>
                              {t('bottomSheet.estimatedRideCost', 'Estimated Ride Cost')}
                            </h4>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span className={`text-xs ${trafficInfo?.color || 'text-gray-500'}`}>
                                {trafficInfo?.icon?.includes('sun') ? <IconSun className="w-4 h-4 inline-block mr-1" /> : (trafficInfo?.icon?.includes('cloud') ? <IconRain className="w-4 h-4 inline-block mr-1" /> : <IconCar className="w-4 h-4 inline-block mr-1" />)}
                                {trafficInfo?.description || t('bottomSheet.normalTraffic', 'Normal traffic')}
                              </span>
                              <span className={`text-xs ${isDark ? 'text-ios-gray-400' : 'text-gray-600'
                                }`}>
                                {distanceToOffice?.toFixed(1)} km
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowFareDetails(!showFareDetails)}
                          className={`text-xs px-3 py-1 rounded-full transition-colors ${isDark
                            ? 'bg-ios-gray-700 text-ios-gray-300 hover:bg-ios-gray-600'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                            }`}
                        >
                          {showFareDetails ? t('bottomSheet.hide', 'Hide') : t('bottomSheet.showAll', 'Show All')}
                        </button>
                      </div>

                      {/* Cheapest Option Highlight */}
                      {cheapestFare && (
                        <div className={`rounded-lg p-3 mb-3 ${isDark ? 'bg-black/30' : 'bg-white/80'
                          }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`text-xs font-medium ${isDark ? 'text-ios-gray-300' : 'text-gray-600'
                                }`}>
                                <IconSun className="w-3 h-3 inline-block mr-1" />
                                {t('bottomSheet.cheapestOption', 'Cheapest Option')}
                              </p>
                              <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'
                                }`}>
                                {renderIcon(cheapestFare.icon)} {cheapestFare.displayName}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`text-2xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'
                                }`}>
                                {formatFare(cheapestFare.total)}
                              </p>
                              <p className={`text-xs ${isDark ? 'text-ios-gray-400' : 'text-gray-500'
                                }`}>
                                ~{cheapestFare.estimatedMinutes} {t('bottomSheet.estimatedTime', 'min')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Detailed Fare Breakdown */}
                      <AnimatePresence>
                        {showFareDetails && fareEstimates && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3 mt-3"
                          >
                            {/* Uber Options */}
                            <div>
                              <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-ios-gray-300' : 'text-gray-700'
                                }`}>
                                {t('bottomSheet.uberServices', 'Uber Services')}
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                {Object.entries(fareEstimates.uber).map(([key, fare]) => (
                                  <div
                                    key={key}
                                    className={`p-3 rounded-lg border ${isDark
                                      ? 'bg-black/20 border-gray-700'
                                      : 'bg-white/60 border-gray-200'
                                      }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <div className="flex items-center space-x-2">
                                          <span className="text-sm">{renderIcon(fare.icon)}</span>
                                          <span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'
                                            }`}>
                                            {fare.displayName}
                                          </span>
                                        </div>
                                        <p className={`text-xs mt-1 ${isDark ? 'text-ios-gray-400' : 'text-gray-500'
                                          }`}>
                                          {fare.description}
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className={`text-sm font-bold ${isDark ? 'text-green-400' : 'text-green-600'
                                          }`}>
                                          {formatFare(fare.total)}
                                        </p>
                                        {fare.trafficSurcharge > 0 && (
                                          <p className={`text-xs ${isDark ? 'text-orange-400' : 'text-orange-600'
                                            }`}>
                                            +{formatFare(fare.trafficSurcharge)}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Bolt Options */}
                            {fareEstimates.bolt && (
                              <div>
                                <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-ios-gray-300' : 'text-gray-700'
                                  }`}>
                                  {t('bottomSheet.boltServices', 'Bolt Services')}
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                  {Object.entries(fareEstimates.bolt).map(([key, fare]) => (
                                    <div
                                      key={key}
                                      className={`p-3 rounded-lg border ${isDark
                                        ? 'bg-black/20 border-gray-700'
                                        : 'bg-white/60 border-gray-200'
                                        }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <div className="flex items-center space-x-2">
                                            <span className="text-sm">{renderIcon(fare.icon)}</span>
                                            <span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'
                                              }`}>
                                              {fare.displayName}
                                            </span>
                                          </div>
                                          <p className={`text-xs mt-1 ${isDark ? 'text-ios-gray-400' : 'text-gray-500'
                                            }`}>
                                            {fare.description}
                                          </p>
                                        </div>
                                        <div className="text-right">
                                          <p className={`text-sm font-bold ${isDark ? 'text-green-400' : 'text-green-600'
                                            }`}>
                                            {formatFare(fare.total)}
                                          </p>
                                          {fare.trafficSurcharge > 0 && (
                                            <p className={`text-xs ${isDark ? 'text-orange-400' : 'text-orange-600'
                                              }`}>
                                              +{formatFare(fare.trafficSurcharge)}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Traffic Info */}
                            {fareEstimates.traffic?.multiplier > 1 && (
                              <div className={`text-xs p-2 rounded mt-2 ${isDark
                                ? 'bg-orange-900/20 text-orange-300'
                                : 'bg-orange-50 text-orange-700'
                                }`}>
                                <IconSun className="w-4 h-4 inline-block mr-1" />
                                {fareEstimates.traffic.description} - {t('bottomSheet.trafficSurchargeIncluded', 'Prices include traffic surcharge')}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Disclaimer */}
                      <p className={`text-xs mt-3 italic ${isDark ? 'text-ios-gray-400' : 'text-gray-500'
                        }`}>
                        {FARE_DISCLAIMER.en}
                      </p>
                    </div>
                  )}
                  {/* ── TRAVEL DIFFICULTY CARD ── */}
                  {travelInsights && (
                    <div className={`rounded-xl p-4 border transition-colors duration-300 ${isDark
                      ? 'bg-gradient-to-br from-blue-900/20 to-blue-900/20 border-blue-700/30'
                      : 'bg-gradient-to-br from-blue-50 to-blue-50 border-blue-200'
                      }`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <IconCompass className="w-5 h-5" />
                          <div>
                            <h4 className={`text-sm font-semibold ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                              Travel Difficulty
                            </h4>
                            <p className={`text-xs mt-0.5 ${isDark ? 'text-ios-gray-400' : 'text-gray-600'}`}>
                              Real-time conditions analysis
                            </p>
                          </div>
                        </div>
                        <span className={`text-xl font-bold px-3 py-1 rounded-xl ${travelInsights.severity === 'low'
                          ? isDark ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-700'
                          : travelInsights.severity === 'medium'
                            ? isDark ? 'bg-yellow-900/40 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                            : isDark ? 'bg-red-900/40 text-red-400' : 'bg-red-100 text-red-700'
                          }`}>
                          {travelInsights.score}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Weather */}
                        <div className={`p-2.5 rounded-lg ${isDark ? 'bg-black/20' : 'bg-white/60'
                          }`}>
                          <p className={`text-xs font-medium ${isDark ? 'text-ios-gray-300' : 'text-gray-700'}`}>
                            Weather
                          </p>
                          <p className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {travelInsights.weatherDesc}
                          </p>
                          {travelInsights.temperature !== null && (
                            <p className={`text-xs mt-0.5 ${isDark ? 'text-ios-gray-400' : 'text-gray-500'}`}>
                              {travelInsights.temperature}°C
                            </p>
                          )}
                        </div>

                        {/* Wind */}
                        <div className={`p-2.5 rounded-lg ${isDark ? 'bg-black/20' : 'bg-white/60'
                          }`}>
                          <p className={`text-xs font-medium ${isDark ? 'text-ios-gray-300' : 'text-gray-700'}`}>
                            Conditions
                          </p>
                          {travelInsights.windSpeed !== null && (
                            <p className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              <IconWindy className="w-4 h-4 inline-block mr-1" />
                              {travelInsights.windSpeed} km/h
                            </p>
                          )}
                          {travelInsights.precipProb !== null && travelInsights.precipProb > 0 && (
                            <p className={`text-xs mt-0.5 ${isDark ? 'text-ios-gray-400' : 'text-gray-500'}`}>
                              <IconRain className="w-4 h-4 inline-block mr-1" />
                              {travelInsights.precipProb}% rain
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Score Explanation */}
                      <p className={`text-xs mt-3 ${isDark ? 'text-ios-gray-400' : 'text-gray-500'}`}>
                        Score: 0 (easiest) → 100 (hardest). Factors: distance, time, traffic, weather.
                      </p>

                      {travelInsights.stale && (
                        <p className={`text-xs mt-1 italic ${isDark ? 'text-ios-gray-500' : 'text-gray-400'}`}>
                          ⏱ Some data may be stale — check again when online
                        </p>
                      )}

                      {/* AI Intelligence Layer Display — Nasaka Blue Theme */}
                      {travelInsights.aiScore !== null && travelInsights.aiScore !== undefined && (
                        <div className={`mt-4 p-3 rounded-xl border ${isDark ? 'bg-[#0b63c6]/10 border-[#0b63c6]/30' : 'bg-blue-50 border-blue-200'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${travelInsights.aiConfidence === 'high' ? 'bg-green-500' : travelInsights.aiConfidence === 'medium' ? 'bg-yellow-500' : 'bg-red-500'} animate-pulse`} />
                              <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-blue-400' : 'text-[#0b63c6]'}`}>
                                AI Intelligence
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {travelInsights.aiGroundTruthVerified && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400 font-bold">✓ Ground Truth</span>
                              )}
                              <span className={`text-lg font-black ${travelInsights.aiScore <= 25 ? (isDark ? 'text-green-400' : 'text-green-600')
                                : travelInsights.aiScore <= 50 ? (isDark ? 'text-yellow-400' : 'text-yellow-600')
                                  : travelInsights.aiScore <= 75 ? (isDark ? 'text-orange-400' : 'text-orange-600')
                                    : (isDark ? 'text-red-400' : 'text-red-600')
                                }`}>{travelInsights.aiScore}<span className="text-xs font-medium opacity-60">/100</span></span>
                            </div>
                          </div>
                          {travelInsights.aiReason && (
                            <p className={`text-xs leading-relaxed ${isDark ? 'text-blue-100/70' : 'text-blue-900/70'}`}>
                              {travelInsights.aiReason}
                            </p>
                          )}
                          {travelInsights.aiGroundTruthNote && (
                            <p className={`text-[10px] mt-1.5 italic ${isDark ? 'text-ios-gray-400' : 'text-gray-500'}`}>
                              🌍 {travelInsights.aiGroundTruthNote}
                            </p>
                          )}
                          <div className={`text-[9px] mt-2 flex items-center gap-1 ${isDark ? 'text-ios-gray-500' : 'text-gray-400'}`}>
                            <span>Powered by</span>
                            <span className="font-bold uppercase text-[#0b63c6]">{
                              travelInsights.aiProvider === 'consensus' ? 'Nasaka Consensus'
                                : travelInsights.aiProvider === 'mistral' ? 'Mistral-7B'
                                  : travelInsights.aiProvider === 'groq' ? 'Groq/Llama 3'
                                    : travelInsights.aiProvider === 'gemini' ? 'Gemini'
                                      : travelInsights.aiProvider === 'cached' ? 'Cached'
                                        : 'Algorithm'
                            }</span>
                            <span>•</span>
                            <span>{travelInsights.aiConfidence} confidence</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Location Information */}
                  <div className="space-y-2">
                    {office.constituency_name && (
                      <div className="flex items-center text-sm">
                        <span className={isDark ? 'text-ios-gray-400' : 'text-gray-500'}>
                          <IconPin className="w-4 h-4 inline-block mr-1 opacity-70" />
                          {office.constituency_name}, {office.county}
                        </span>
                      </div>
                    )}
                    {office.phone && (
                      <div className="flex items-center text-sm">
                        <a href={`tel:${office.phone}`} className={`hover:underline ${isDark ? 'text-ios-blue-300' : 'text-blue-600'
                          }`}>
                          <IconPhone className="w-4 h-4 inline-block mr-1" />
                          {office.phone}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Distance & Route Info - ONLY SHOW IF LOCATION ACCESS GRANTED */}
                  {hasLocationAccess && distanceToOffice && (
                    <div className={`rounded-xl p-4 border transition-colors duration-300 ${isDark
                      ? 'bg-ios-blue/20 border-ios-blue/30'
                      : 'bg-primary/10 border-primary/20'
                      }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-ios-gray-200' : 'text-foreground'
                            }`}>
                            {t('bottomSheet.distance', 'Distance')}
                          </p>
                          <p className={`text-2xl font-bold mt-1 transition-colors duration-300 ${isDark ? 'text-ios-blue-400' : 'text-primary'
                            }`}>
                            {distanceToOffice.toFixed(1)} km
                          </p>
                        </div>
                        {currentRoute && currentRoute[0] && (
                          <div className="text-right">
                            <p className={`text-sm font-medium transition-colors duration-300 ${isDark ? 'text-ios-gray-200' : 'text-foreground'
                              }`}>
                              {t('bottomSheet.driveTime', 'Drive Time')}
                            </p>
                            <p
                              className={`text-2xl font-bold mt-1 transition-colors duration-300 ${isDark ? 'text-ios-blue-400' : 'text-primary'
                                }`}
                            >
                              {i18next.language === 'en'
                                ? `${Math.round(currentRoute[0].summary.totalTime / 60)} ${t('bottomSheet.estimatedTime', 'min')}`
                                : `${t('bottomSheet.estimatedTime', 'min')} ${Math.round(currentRoute[0].summary.totalTime / 60)}`}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* GET THERE SECTION - CONDITIONAL BASED ON LOCATION ACCESS */}
                  <div className="space-y-3 pt-2">
                    <h4
                      className={`text-center text-lg md:text-xl font-semibold mb-3 ${isDark ? 'text-ios-gray-200' : 'text-gray-900'
                        }`}
                    >
                      {t('bottomSheet.navigationOptions', 'Get There')}
                    </h4>

                    {/* ✅ View Full Details Link (Full Ham) */}
                    <button
                      onClick={() => {
                        const countySlug = slugify(office.county);
                        let areaSlug = slugify(office.constituency_name || '');
                        if (areaSlug === countySlug) areaSlug = `${areaSlug}-town`;
                        navigate(`/${countySlug}/${areaSlug}`);
                      }}
                      className={`w-full mb-4 font-semibold py-4 px-6 rounded-2xl flex items-center justify-center space-x-2 transition-all active:scale-95 duration-300 shadow-lg ${isDark
                        ? 'bg-ios-blue-600 text-white shadow-ios-blue/30'
                        : 'bg-ios-blue text-white shadow-ios-blue/20'
                        }`}
                    >
                      <span>View Verified Office Records</span>
                      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>

                    <div className={`grid gap-3 ${hasLocationAccess ? 'grid-cols-2' : 'grid-cols-1'
                      }`}>
                      {/* Uber Button - Conditional behavior based on location access */}
                      <button
                        onClick={() => openUber()}
                        className={`w-full font-semibold py-3 px-4 rounded-2xl flex flex-col items-center justify-center space-y-1 transition-all active:scale-95 duration-300 ${uberColors.bg} ${uberColors.text} ${uberColors.hover} ${uberColors.border} ${uberColors.shadow}`}
                      >
                        <div className="flex items-center space-x-2">
                          <IconCar className="w-5 h-5" />
                          <span className="text-sm font-medium">
                            {t('bottomSheet.bookWithUber', 'Uber')}
                          </span>
                        </div>
                        {hasLocationAccess && cheapestFare && cheapestFare.provider === 'uber' && (
                          <span className={`text-xs font-medium ${isDark ? 'text-green-400' : 'text-green-600'
                            }`}>
                            {formatFare(cheapestFare.total)}
                          </span>
                        )}
                        {!hasLocationAccess && (
                          <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                            {t('bottomSheet.openApp', 'Open app')}
                          </span>
                        )}
                      </button>

                      {/* Bolt Button - Conditional behavior based on location access */}
                      <button
                        onClick={openBolt}
                        className={`w-full font-semibold py-3 px-4 rounded-2xl flex flex-col items-center justify-center space-y-1 transition-all active:scale-95 duration-300 ${boltColors.bg}  ${boltColors.text} ${boltColors.hover} ${boltColors.border} ${boltColors.shadow}`}
                      >
                        <div className="flex items-center space-x-2">
                          <IconBolt className="w-5 h-5" />
                          <span className="text-sm font-medium">
                            {t('bottomSheet.bookWithBolt', 'Bolt')}
                          </span>
                        </div>
                        {hasLocationAccess && cheapestFare && cheapestFare.provider === 'bolt' && (
                          <span className="text-xs font-medium text-yellow-300">
                            {formatFare(cheapestFare.total)}
                          </span>
                        )}
                        {!hasLocationAccess && (
                          <span className="text-xs font-medium text-yellow-200">
                            {t('bottomSheet.openApp', 'Open app')}
                          </span>
                        )}
                      </button>

                      {/* Google Maps Button - ALWAYS AVAILABLE */}
                      <button
                        onClick={openGoogleMaps}
                        className={`w-full font-semibold py-3 px-4 rounded-2xl flex items-center justify-center space-x-2 transition-all active:scale-95 duration-300 ${googleColors.bg} ${googleColors.text} ${googleColors.hover} ${googleColors.border} ${googleColors.shadow}`}
                      >
                        <IconGoogleMaps className="w-5 h-5" />
                        <span className="text-sm font-medium">
                          {t('bottomSheet.openInGoogleMaps', 'Google Maps')}
                        </span>
                      </button>

                      {/* Apple Maps Button - ALWAYS AVAILABLE */}
                      <button
                        onClick={openAppleMaps}
                        className={`w-full font-semibold py-3 px-4 rounded-2xl flex items-center justify-center space-x-2 transition-all active:scale-95 duration-300 ${appleColors.bg} ${appleColors.text} ${appleColors.hover} ${appleColors.border} ${appleColors.shadow}`}
                      >
                        <IconAppleMaps className="w-5 h-5" />
                        <span className="text-sm font-medium">
                          {t('bottomSheet.openInAppleMaps', 'Apple Maps')}
                        </span>
                      </button>
                    </div>

                    {/* Copy Coordinates - ALWAYS AVAILABLE */}
                    {office.latitude && office.longitude && (
                      <button
                        onClick={copyCoords}
                        className={`w-full font-medium py-3 px-6 rounded-2xl flex items-center justify-center space-x-2 transition-all active:scale-95 duration-300 ${isDark
                          ? 'bg-ios-gray-700 hover:bg-ios-gray-600 text-ios-gray-200'
                          : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                          }`}
                      >
                        <IconCopy className="w-5 h-5" />

                        <span>{t('bottomSheet.copyCoordinates', 'Copy Coordinates')}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Close Button */}
                <div className={`sticky bottom-0 pt-4 pb-2 mt-6 border-t transition-colors duration-300 ${isDark
                  ? 'bg-card border-ios-gray-600'
                  : 'bg-background border-border'
                  }`}>
                  <button
                    onClick={onClose}
                    className={`w-full font-medium py-3 px-6 rounded-2xl transition-all active:scale-95 duration-300 ${isDark
                      ? 'bg-ios-gray-700 hover:bg-ios-gray-600 text-ios-gray-200'
                      : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                      }`}
                  >
                    {t('common.close', 'Close')}
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Uber Modal - ALWAYS RENDERED BUT CONDITIONALLY SHOWN */}
      <UberModal
        isOpen={showUberModal}
        onClose={() => setShowUberModal(false)}
        onProductSelect={(product) => openUber(product.productType)}
        pickup={pickup}
        destination={destination}
        fareEstimates={fareEstimates}
      />
    </>
  );
};

export default OfficeBottomSheet;
