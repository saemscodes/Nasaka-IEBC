export const generateGoogleMapsUrl = (lat, lng, travelMode = 'driving') => {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${travelMode}`;
};

export const generateAppleMapsUrl = (lat, lng) => {
  return `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
};

export const openNavigation = (lat, lng) => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const url = isIOS 
    ? generateAppleMapsUrl(lat, lng)
    : generateGoogleMapsUrl(lat, lng);
  
  window.open(url, '_blank');
};

export const canOpenInMaps = () => {
  return typeof window !== 'undefined' && (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('Android'));
};
