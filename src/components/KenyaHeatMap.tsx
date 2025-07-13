import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Users, TrendingUp } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

interface CountyData {
  county: string;
  voters: number;
  constituencies: Array<{
    name: string;
    voters: number;
  }>;
}

const KenyaHeatMap = () => {
  // Parse CSV data for statistics
  const parseCSVData = (): CountyData[] => {
    const csvData = `MOMBASA,-4.0435,39.6682,93561,Changamwe,"port reitz, kipevu, airport, changamwe, chaani",93561
MOMBASA,-4.0435,39.6682,93561,Jomvu,"jomvu kuu, miritini, mikindani",75085
MOMBASA,-4.0435,39.6682,93561,Kisauni,"mjambere, junda, bamburi, mwakirunge, mtopanga, magogoni, shanzu",135276
MOMBASA,-4.0435,39.6682,93561,Nyali,"frere town, ziwa la ng'ombe, mkomani, kongowea, kadzandani",124253
MOMBASA,-4.0435,39.6682,93561,Likoni,"mtongwe, shika adabu, bofu, likoni, timbwani",94764
MOMBASA,-4.0435,39.6682,93561,Mvita,"mji wa kale/makadara, tudor, tononoka, shimanzi/ganjoni, majengo",118974
NAIROBI,-1.2864,36.8172,160739,Westlands,"kitisuru, parklands/highridge, karura, kangemi, mountain view",160739
NAIROBI,-1.2864,36.8172,160739,Dagoretti North,"kilimani, kawangware, gatina, kileleshwa, kabiro",157659
NAIROBI,-1.2864,36.8172,160739,Starehe,"nairobi central, ngara, ziwani/kariokor, pangani, landimawe, nairobi south",169575
KIAMBU,-1.0314,36.8685,79860,Gatundu South,"kiamwangi, kiganjo, ndarugu, ngenda",79860
KIAMBU,-1.0314,36.8685,79860,Ruiru,"gitothua, biashara, gatongora, kahawa sukari, kahawa wendani, kiuu, mwiki, mwihoko",172088`;

    const lines = csvData.trim().split('\n');
    const countiesMap = new Map<string, CountyData>();

    lines.forEach(line => {
      const [county, , , , constituency_name, , constituency_voters] = line.split(',');
      
      if (!countiesMap.has(county)) {
        countiesMap.set(county, {
          county: county,
          voters: 0,
          constituencies: []
        });
      }
      
      const countyData = countiesMap.get(county)!;
      countyData.constituencies.push({
        name: constituency_name,
        voters: parseInt(constituency_voters)
      });
      
      countyData.voters += parseInt(constituency_voters);
    });

    return Array.from(countiesMap.values());
  };

  const countyData = parseCSVData();
  const totalConstituencies = countyData.reduce((total, county) => total + county.constituencies.length, 0);

  return (
    <div className="space-y-6">
      <Card className="border-green-200 bg-gradient-to-br from-green-50/50 to-white">
        <CardHeader>
          <CardTitle className="flex items-center text-green-900">
            <MapPin className="w-5 h-5 mr-2" />
            Kenya Electoral Map
          </CardTitle>
          <CardDescription className="text-green-700">
            Interactive map showing voter distribution across Kenyan counties
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="w-full h-[500px] rounded-lg overflow-hidden border border-green-200">
                <iframe 
                  src="https://www.google.com/maps/d/embed?mid=1YZGfnjJj9Ajzu6xhWEF_sg_RFB0j7NY&ehbc=2E312F&noprof=1" 
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  style={{ border: 0 }}
                  allowFullScreen
                  aria-hidden="false"
                  tabIndex={0}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-900 mb-2">Map Legend</h4>
                <div className="space-y-2 text-sm text-green-700">
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full bg-green-500/60 border-2 border-green-600 mr-2"></div>
                    <span>County markers (size = voter count)</span>
                  </div>
                  <div className="text-xs text-green-600">
                    Interactive map showing Kenyan electoral boundaries
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-100 to-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-900 mb-3 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  County Statistics
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-center p-2 bg-white rounded border border-green-100">
                    <div className="font-bold text-green-800">{countyData.length}</div>
                    <div className="text-green-600">Counties</div>
                  </div>
                  <div className="text-center p-2 bg-white rounded border border-green-100">
                    <div className="font-bold text-green-800">
                      {totalConstituencies}
                    </div>
                    <div className="text-green-600">Constituencies</div>
                  </div>
                  <div className="text-center p-2 bg-white rounded border border-green-100 col-span-2">
                    <div className="font-bold text-green-800">
                      {countyData.reduce((total, county) => total + county.voters, 0).toLocaleString()}
                    </div>
                    <div className="text-green-600">Total Registered Voters</div>
                  </div>
                </div>
              </div>

              <Card className="border-green-200 bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-green-900">
                    About This Map
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-green-700">
                  <p className="mb-2">
                    This official IEBC map shows electoral boundaries and voter distribution data across Kenya.
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Zoom in/out to explore regions</li>
                    <li>Click on counties for detailed information</li>
                    <li>Compare voter densities across regions</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KenyaHeatMap;
