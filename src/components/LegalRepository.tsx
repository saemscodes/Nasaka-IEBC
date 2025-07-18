
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scale, FileText, CheckCircle, AlertTriangle, ExternalLink, BookOpen } from 'lucide-react';

const LegalRepository = () => {
  const [selectedLaw, setSelectedLaw] = useState<string | null>(null);

  const legalDocuments = {
    kica: {
      id: 'KICA-83C',
      title: 'Kenya Information & Communications Act §83C',
      summary: 'Defines requirements for advanced electronic signatures',
      excerpt: 'Advanced electronic signatures shall be considered legally equivalent to handwritten signatures where they meet the following requirements...',
      requirements: [
        'Uniquely linked to signatory',
        'Capable of identifying signatory', 
        'Created under signatory\'s sole control',
        'Tamper-evident'
      ],
      status: 'active',
      relevance: ['signature-creation', 'petition-submission'],
      fullTextUrl: "https://kenyalaw.org/kl/fileadmin/pdfdownloads/Acts/KenyaInformationandCommunicationsAct(No2of1998).pdf#page=1",
      analysisUrl: "https://www.kaplanstratton.com/wp-content/uploads/2022/03/Legal-Recognition-of-Electronic-Signatures-in-Kenya.pdf#page=1"
      
    },
    katibaRuling: {
      id: 'HC-PET-209-2016',
      title: 'Katiba Institute v Attorney General',
      summary: 'High Court ruling validating digital recall petitions',
      excerpt: 'The procedural requirements for recall petitions must not create impossible hurdles... Digital solutions that enhance practical effectiveness are constitutionally permissible',
      citation: 'Para. 71-75, High Court Petition 209 of 2016',
      status: 'landmark',
      relevance: ['petition-initiation', 'technology-use'],
      fullTextUrl: "https://new.kenyalaw.org/akn/ke/judgment/keca/2020/513/eng@2020-07-24",
      analysisUrl: "https://new.kenyalaw.org/akn/ke/judgment/kehc/2025/8557/eng@2025-04-30#:~:text=This%20violates%20Article%2027(1,of%20association%20and%20administrative%20justice."
    },
    electionsAct: {
      id: 'ELECTIONS-ACT-45-46',
      title: 'Elections Act Amendments',
      summary: 'Parliamentary provisions for recall petitions',
      requirements: [
        'Recall petitions permitted (§45)',
        'No restriction on initiators (§45(6) voided)',
        'Geographic distribution required (§46(4))'
      ],
      status: 'active',
      relevance: ['petition-requirements', 'geographic-distribution'],
      fullTextUrl: "https://www.iebc.or.ke/uploads/resources/kqI5cmgeyB.pdf",
      analysisUrl: "https://www.idea.int/answer/ans9283269885535"
    },
    constitution104: {
      id: 'CONST-ART-104',
      title: 'Constitution Article 104',
      summary: 'Constitutional foundation for MP recall',
      excerpt: 'A member of Parliament may be recalled by the voters of the constituency who elected the member before the expiry of the term of the relevant House of Parliament.',
      requirements: [
        '30% of registered voters must sign',
        'Geographic distribution across wards',
        '30-day petition period',
        'Grounds must be substantial'
      ],
      status: 'constitutional',
      relevance: ['fundamental-rights', 'recall-process'],
      fullTextUrl: "https://www.iebc.or.ke/uploads/resources/kqI5cmgeyB.pdf",
      analysisUrl: "http://www.parliament.go.ke/sites/default/files/2023-03/The_Constitution_of_Kenya_2010.pdf#page=63"
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Legal Framework Header */}
      <Card className="border-kenya-green/30 bg-gradient-to-r from-kenya-green/5 to-kenya-green/10">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl text-kenya-green">
            <Scale className="w-8 h-8 mr-3" />
            Constitutional Legal Framework
          </CardTitle>
          <CardDescription className="text-lg">
            Comprehensive legal foundation ensuring constitutional compliance for MP recall petitions
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Legal Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(legalDocuments).map(([key, doc]) => (
          <Card key={key} className="border-2 hover:border-kenya-green/40 transition-all cursor-pointer"
                onClick={() => setSelectedLaw(selectedLaw === key ? null : key)}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg text-kenya-green-200 mb-2">
                    {doc.title}
                  </CardTitle>
                  <Badge className={
                    doc.status === 'constitutional' ? 'bg-red-100 text-red-800' :
                    doc.status === 'landmark' ? 'bg-purple-100 text-purple-800' :
                    'bg-kenya-green/20 text-kenya-green'
                  }>
                    {doc.status.toUpperCase()}
                  </Badge>
                </div>
                <ExternalLink className="w-5 h-5 text-gray-400" />
              </div>
            </CardHeader>

            <CardContent>
              <p className="text-gray-700 mb-3 text-sm leading-relaxed">
                {doc.summary}
              </p>

              {'excerpt' in doc && doc.excerpt && (
                <blockquote className="border-l-4 border-kenya-green/30 pl-4 mb-3 text-sm italic text-gray-600">
                  "{doc.excerpt}"
                  {'citation' in doc && doc.citation && (
                    <cite className="block text-xs mt-2 not-italic text-gray-500">
                      — {doc.citation}
                    </cite>
                  )}
                </blockquote>
              )}

              {'requirements' in doc && doc.requirements && (
                <div className="space-y-2">
                  <h5 className="font-semibold text-kenya-black text-sm">Key Requirements:</h5>
                  <ul className="space-y-1">
                    {doc.requirements.map((req, index) => (
                      <li key={index} className="flex items-start text-sm">
                        <CheckCircle className="w-4 h-4 text-kenya-green mr-2 mt-0.5 flex-shrink-0" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Expanded Content */}
              {selectedLaw === key && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex space-x-2">
                    <Button size="sm" className="bg-kenya-green hover:bg-kenya-green/90">
                      <BookOpen className="w-4 h-4 mr-1" />
                      Full Text
                    </Button>
                    <Button size="sm" variant="outline" className="border-kenya-green text-kenya-green">
                      Legal Analysis
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Interactive Constitutional Flowchart */}
      <Card className="border-kenya-green/30">
        <CardHeader>
          <CardTitle className="flex items-center text-kenya-green">
            <FileText className="w-6 h-6 mr-2" />
            Constitutional Recall Process Flowchart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="grounds" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="grounds">1. Legal Grounds</TabsTrigger>
              <TabsTrigger value="signatures">2. Signature Collection</TabsTrigger>
              <TabsTrigger value="verification">3. Verification</TabsTrigger>
              <TabsTrigger value="recall-vote">4. Recall Vote</TabsTrigger>
            </TabsList>

            <TabsContent value="grounds" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-red-200 bg-red-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-red-800">Chapter 6 Violation</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-red-700">
                    Breach of leadership and integrity requirements
                  </CardContent>
                </Card>
                <Card className="border-yellow-200 bg-yellow-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-yellow-800">Funds Misappropriation</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-yellow-700">
                    Misuse of public resources or CDF funds
                  </CardContent>
                </Card>
                <Card className="border-purple-200 bg-purple-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-purple-800">Electoral Crime</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-purple-700">
                    Conviction for electoral offenses
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="signatures" className="mt-6">
              <div className="space-y-4">
                <div className="bg-kenya-green/5 border border-kenya-green/20 rounded-lg p-4">
                  <h4 className="font-semibold text-kenya-green mb-2">Constitutional Requirements (Art. 104)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-kenya-green mr-2" />
                      <span>30% of registered voters</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-kenya-green mr-2" />
                      <span>50% ward distribution</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-kenya-green mr-2" />
                      <span>30-day collection period</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-kenya-green mr-2" />
                      <span>CAK-certified signatures</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="verification" className="mt-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-kenya-black">Four-Eyes Verification Process</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-blue-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2 text-blue-600" />
                        IEBC Verification
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs">
                      Real-time voter registration check via IEBC API
                    </CardContent>
                  </Card>
                  <Card className="border-green-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                        National ID Verification
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs">
                      Biometric and database cross-verification
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="recall-vote" className="mt-6">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">IEBC Recall Election Process</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Upon successful petition verification, IEBC conducts a recall election within 90 days.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white p-3 rounded border">
                    <strong>Simple Majority</strong><br/>
                    50% + 1 of votes cast
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <strong>Minimum Turnout</strong><br/>
                    30% of registered voters
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <strong>By-Election</strong><br/>
                    If recall succeeds
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default LegalRepository;
