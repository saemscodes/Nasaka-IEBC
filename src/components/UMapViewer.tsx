
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, MapPin } from 'lucide-react';

interface UMapViewerProps {
  className?: string;
}

const UMapViewer: React.FC<UMapViewerProps> = ({ className }) => {
  const fullScreenUrl = "https://umap.openstreetmap.fr/en/map/kenyas-counties_1256042?scaleControl=false&miniMap=false&scrollWheelZoom=true&zoomControl=true&editMode=disabled&moreControl=true&searchControl=null&tilelayersControl=null&embedControl=null&datalayersControl=true&onLoadPanel=none&captionBar=false&captionMenus=true";

  const openFullScreen = () => {
    window.open(fullScreenUrl, '_blank');
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader className="bg-green-50 dark:bg-green-900/30">
          <CardTitle className="flex items-center text-green-800 dark:text-green-100">
            <MapPin className="w-5 h-5 mr-2" />
            UMap - OpenStreetMap
          </CardTitle>
          <CardDescription className="text-green-600 dark:text-green-300">
            Collaborative mapping platform with Kenya Counties electoral boundaries
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative">
            <iframe
              width="100%"
              height="500px"
              frameBorder="0"
              allowFullScreen
              allow="geolocation"
              src="//umap.openstreetmap.fr/en/map/kenyas-counties_1256042?scaleControl=false&miniMap=false&scrollWheelZoom=false&zoomControl=true&editMode=disabled&moreControl=true&searchControl=null&tilelayersControl=null&embedControl=null&datalayersControl=true&onLoadPanel=none&captionBar=false&captionMenus=true"
              title="Kenya Counties UMap"
              className="w-full"
            />
            
            <div className="absolute top-4 right-4 z-10">
              <Button
                onClick={openFullScreen}
                size="sm"
                className="bg-white/90 text-gray-900 hover:bg-white border border-gray-300"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Full Screen
              </Button>
            </div>
          </div>
          
          <div className="p-6">
            <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg border border-green-200 dark:border-green-700">
              <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                UMap Features
              </h4>
              <div className="space-y-1 text-sm text-green-700 dark:text-green-300">
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  <span>Collaborative editing and sharing</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  <span>Multiple data layers support</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  <span>Custom styling and popups</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  <span>Export to various formats</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  <span>Embeddable in websites</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UMapViewer;
