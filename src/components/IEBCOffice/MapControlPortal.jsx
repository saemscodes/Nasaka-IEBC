// src/components/IEBCOffice/MapControlPortal.jsx
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export default function MapControlPortal({ 
  children, 
  paneName = 'uiOverlayPane', 
  zIndex = 650,
  className = ''
}) {
  const map = useMap();
  const [portalRoot, setPortalRoot] = useState(null);
  const elementRef = useRef(null);

  useEffect(() => {
    if (!map) return;
    
    // Create pane if it doesn't exist
    if (!map.getPane(paneName)) {
      map.createPane(paneName);
      const pane = map.getPane(paneName);
      pane.style.zIndex = zIndex;
      // Critical: allow clicks to pass through to map below
      pane.style.pointerEvents = 'none';
    }
    
    // Create container for our UI
    const element = L.DomUtil.create('div', 'leaflet-ui-overlay');
    element.style.pointerEvents = 'auto'; // Re-enable clicks for UI
    element.style.position = 'absolute';
    element.style.top = '0';
    element.style.left = '0';
    element.style.width = '100%';
    element.style.height = '100%';
    
    if (className) {
      element.className = className;
    }
    
    map.getPane(paneName).appendChild(element);
    elementRef.current = element;
    setPortalRoot(element);

    return () => {
      if (elementRef.current && map.getPane(paneName)) {
        map.getPane(paneName).removeChild(elementRef.current);
      }
      setPortalRoot(null);
    };
  }, [map, paneName, zIndex, className]);

  if (!portalRoot) return null;
  return createPortal(children, portalRoot);
}
