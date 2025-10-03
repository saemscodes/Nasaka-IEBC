// src/pages/VoterRegistration.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import IEBCVoterRegistrationMap from "@/components/IEBCVoterRegistrationMap";

const VoterRegistrationPage = () => {
  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-blue-900">
            IEBC Voter Registration Offices
          </CardTitle>
          <CardDescription className="text-xl text-gray-600">
            Find your nearest voter registration office across Kenya
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <IEBCVoterRegistrationMap 
            recallGeoJsonUrl="https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/sign/map-data/FULL%20CORRECTED%20-%20Kenya%20Counties%20Voters%27%20Data.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kN2NhMTc4OC1jOGY0LTQzNTYtODRiNy1lMzA0ODJiMjcyMzMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXAtZGF0YS9GVUxMIENPUlJFQ1RFRCAtIEtlbnlhIENvdW50aWVzIFZvdGVycycgRGF0YS5nZW9qc29uIiwiaWF0IjoxNzUyNzMwNzI4LCJleHAiOjI1NDExMzA3Mjh9.2pP8klRB2xTLjR6FSQy14blyTZLIGq0B4NQIgEFxUI0"
            officesGeoJsonUrl="/data/iebc_offices.geojson"
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default VoterRegistrationPage;
