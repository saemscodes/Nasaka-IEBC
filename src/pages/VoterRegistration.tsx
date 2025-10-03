import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MapPin, Users, FileText, Clock, Shield,
  Phone, Mail, ExternalLink, Download
} from 'lucide-react';
import IEBCVoterRegistrationMap from "@/components/IEBCVoterRegistrationMap";

const VoterRegistrationPage = () => {
  // IEBC contact information
  const iebcContacts = [
    { type: "Headquarters", phone: "020 276 9000", email: "info@iebc.or.ke" },
    { type: "Voter Registration", phone: "020 276 9000", email: "voterregistration@iebc.or.ke" },
    { type: "Complaints", phone: "0792 987 747", email: "complaints@iebc.or.ke" }
  ];

  // Voter registration requirements
  const requirements = [
    "Must be a Kenyan citizen",
    "Must be 18 years and above", 
    "Must possess a valid Kenyan ID or Passport",
    "Must be of sound mind",
    "Must not have been declared bankrupt",
    "Must not have been convicted of an election offense in the last 5 years"
  ];

  // Registration process steps
  const processSteps = [
    {
      step: 1,
      title: "Visit Registration Office",
      description: "Go to your nearest IEBC constituency office with original ID documents"
    },
    {
      step: 2,
      title: "Fill Application Form",
      description: "Complete the Application for Registration form (Form A)"
    },
    {
      step: 3, 
      title: "Receive Acknowledgement",
      description: "Get your registration acknowledgement slip with voter details"
    },
    {
      step: 4,
      title: "Verify Registration",
      description: "Check your registration status online or at IEBC offices"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-100 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-blue-900 mb-4">
            IEBC Voter Registration
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Find your nearest voter registration office and get all the information you need 
            to register as a voter in Kenya's electoral process
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-sm py-1 px-3">
              <Shield className="w-3 h-3 mr-1" />
              Official IEBC Data
            </Badge>
            <Badge variant="secondary" className="bg-green-100 text-green-700 text-sm py-1 px-3">
              <MapPin className="w-3 h-3 mr-1" />
              290 Constituency Offices
            </Badge>
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-sm py-1 px-3">
              <Users className="w-3 h-3 mr-1" />
              47 Counties Covered
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="map" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5 h-auto p-1 bg-blue-100/50">
            <TabsTrigger value="map" className="flex items-center space-x-2 py-3 data-[state=active]:bg-white">
              <MapPin className="w-4 h-4" />
              <span>Office Map</span>
            </TabsTrigger>
            <TabsTrigger value="info" className="flex items-center space-x-2 py-3 data-[state=active]:bg-white">
              <FileText className="w-4 h-4" />
              <span>Registration Info</span>
            </TabsTrigger>
            <TabsTrigger value="process" className="flex items-center space-x-2 py-3 data-[state=active]:bg-white">
              <Clock className="w-4 h-4" />
              <span>Process</span>
            </TabsTrigger>
            <TabsTrigger value="requirements" className="flex items-center space-x-2 py-3 data-[state=active]:bg-white">
              <Shield className="w-4 h-4" />
              <span>Requirements</span>
            </TabsTrigger>
            <TabsTrigger value="contact" className="flex items-center space-x-2 py-3 data-[state=active]:bg-white">
              <Phone className="w-4 h-4" />
              <span>Contact IEBC</span>
            </TabsTrigger>
          </TabsList>

          {/* Map Tab */}
          <TabsContent value="map" className="space-y-4">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-0">
                <IEBCVoterRegistrationMap 
                  showVoterRegistrationInfo={false}
                  className="w-full"
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Registration Information Tab */}
          <TabsContent value="info" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-blue-600 text-white">
                  <CardTitle className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    Why Register to Vote?
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900">Your Voting Rights</h4>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex items-start">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                        <span>Exercise your constitutional right to choose leaders</span>
                      </li>
                      <li className="flex items-start">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                        <span>Participate in shaping Kenya's future through elections</span>
                      </li>
                      <li className="flex items-start">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                        <span>Hold elected leaders accountable through your vote</span>
                      </li>
                      <li className="flex items-start">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                        <span>Influence important national and county decisions</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-semibold text-yellow-800 mb-2 flex items-center">
                      <Shield className="w-4 h-4 mr-2" />
                      Important Notice
                    </h4>
                    <p className="text-sm text-yellow-700">
                      Multiple voter registration is illegal under Kenyan law. Persons who register 
                      more than once are liable to a fine not exceeding KSh 100,000 or imprisonment 
                      for up to one year, or both. Such persons will be barred from participating 
                      in the immediate election and the next that follows.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-green-600 text-white">
                  <CardTitle className="flex items-center">
                    <Clock className="w-5 h-5 mr-2" />
                    Registration Periods
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900">Continuous Voter Registration</h4>
                    <p className="text-sm text-gray-600">
                      The IEBC conducts continuous voter registration at constituency offices 
                      throughout the year. However, major registration drives are typically 
                      announced before general elections.
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 mb-2">Registration Hours</h4>
                    <div className="text-sm text-blue-700 space-y-1">
                      <p><strong>Weekdays:</strong> 8:00 AM - 5:00 PM</p>
                      <p><strong>Weekends:</strong> Some offices open during registration drives</p>
                      <p><strong>Note:</strong> Hours may vary by constituency</p>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white flex-1">
                      <Download className="w-4 h-4 mr-2" />
                      Download Voter Guide
                    </Button>
                    <Button variant="outline" className="flex-1">
                      Check Registration Status
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Process Tab */}
          <TabsContent value="process">
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-purple-600 text-white">
                <CardTitle className="flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Voter Registration Process
                </CardTitle>
                <CardDescription className="text-purple-100">
                  Follow these simple steps to register as a voter in Kenya
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {processSteps.map((step) => (
                    <div key={step.step} className="text-center">
                      <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl font-bold text-purple-600">{step.step}</span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                      <p className="text-sm text-gray-600">{step.description}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 p-4 bg-gray-50 rounded-lg border">
                  <h4 className="font-semibold text-gray-900 mb-2">What to Bring to Registration</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Original Kenyan National ID Card or Valid Passport</li>
                    <li>• Your current physical address details</li>
                    <li>• Your previous registration details (if transferring)</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Requirements Tab */}
          <TabsContent value="requirements">
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-orange-600 text-white">
                <CardTitle className="flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Voter Registration Requirements
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4 text-lg">Eligibility Criteria</h3>
                    <ul className="space-y-3">
                      {requirements.map((requirement, index) => (
                        <li key={index} className="flex items-start">
                          <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
                            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          </div>
                          <span className="text-gray-700">{requirement}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="font-semibold text-red-800 mb-2">When Registration is Denied</h4>
                      <ul className="text-sm text-red-700 space-y-1">
                        <li>• When you are under 18 years of age</li>
                        <li>• When you don't have original ID card or valid passport</li>
                        <li>• When you are an undischarged bankrupt</li>
                        <li>• When convicted of an election offense in last 5 years</li>
                        <li>• When declared of unsound mind by a competent court</li>
                      </ul>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-800 mb-2">Transfer of Registration</h4>
                      <p className="text-sm text-green-700">
                        You can transfer your voter registration to another constituency 
                        during registration periods. Visit any IEBC office with your 
                        current registration details and new address information.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contact Tab */}
          <TabsContent value="contact">
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-indigo-600 text-white">
                <CardTitle className="flex items-center">
                  <Phone className="w-5 h-5 mr-2" />
                  Contact IEBC
                </CardTitle>
                <CardDescription className="text-indigo-100">
                  Get in touch with the Independent Electoral and Boundaries Commission
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                  {iebcContacts.map((contact, index) => (
                    <div key={index} className="text-center p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                      <h3 className="font-semibold text-indigo-900 mb-3">{contact.type}</h3>
                      <div className="space-y-2">
                        <div className="flex items-center justify-center text-sm text-indigo-700">
                          <Phone className="w-4 h-4 mr-2" />
                          {contact.phone}
                        </div>
                        <div className="flex items-center justify-center text-sm text-indigo-700">
                          <Mail className="w-4 h-4 mr-2" />
                          {contact.email}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">IEBC Headquarters</h3>
                    <div className="text-sm text-gray-600 space-y-2">
                      <p>Anniversary Towers, 6th Floor</p>
                      <p>University Way</p>
                      <p>P.O. Box 45371 - 00100</p>
                      <p>Nairobi, Kenya</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Official Resources</h3>
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full justify-start" asChild>
                        <a href="https://www.iebc.or.ke" target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Visit IEBC Website
                        </a>
                      </Button>
                      <Button variant="outline" className="w-full justify-start" asChild>
                        <a href="https://www.iebc.or.ke/registration/?how" target="_blank" rel="noopener noreferrer">
                          <FileText className="w-4 h-4 mr-2" />
                          Registration Guidelines
                        </a>
                      </Button>
                      <Button variant="outline" className="w-full justify-start" asChild>
                        <a href="https://verify.iebc.or.ke" target="_blank" rel="noopener noreferrer">
                          <Shield className="w-4 h-4 mr-2" />
                          Verify Voter Registration
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer Information */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            This service is provided to help Kenyan citizens find voter registration information. 
            Always verify information with official IEBC sources. Data sourced from IEBC PDF documents 
            and geocoded using OpenStreetMap Nominatim.
          </p>
          <p className="mt-2">
            © {new Date().getFullYear()} Recall254 - Promoting Civic Engagement in Kenya
          </p>
        </div>
      </div>
    </div>
  );
};

export default VoterRegistrationPage;
