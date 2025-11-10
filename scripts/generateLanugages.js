const fs = require('fs');
const path = require('path');

const localesPath = path.join(__dirname, '../src/locales');
const outputPath = path.join(__dirname, '../src/i18n/languages.generated.ts');

// Native names for languages
const NATIVE_NAMES = {
  en: 'English',
  sw: 'Kiswahili',
  ki: 'Kikuyu'
};

// Read the locales directory and find all language folders
const generateLanguages = () => {
  try {
    const items = fs.readdirSync(localesPath);
    const languages = [];

    for (const item of items) {
      const itemPath = path.join(localesPath, item);
      const isDirectory = fs.statSync(itemPath).isDirectory();
      
      if (isDirectory) {
        // Check if nasaka.json exists in this directory
        const nasakaJsonPath = path.join(itemPath, 'nasaka.json');
        if (fs.existsSync(nasakaJsonPath)) {
          languages.push({
            code: item,
            name: NATIVE_NAMES[item] || item.toUpperCase(),
            nativeName: NATIVE_NAMES[item] || item.toUpperCase()
          });
        }
      }
    }

    // Sort languages by code for consistency
    languages.sort((a, b) => a.code.localeCompare(b.code));

    const fileContent = `// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// This file is generated automatically by scripts/generateLanguages.js

export const LANGUAGES = ${JSON.stringify(languages, null, 2)};
`;

    fs.writeFileSync(outputPath, fileContent);
    console.log(`✅ Generated languages.generated.ts with ${languages.length} languages:`, languages.map(l => l.code).join(', '));
  } catch (error) {
    console.error('❌ Error generating languages:', error);
    // Create a fallback file
    const fallbackContent = `// AUTO-GENERATED FILE - Fallback version
export const LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'sw', name: 'Kiswahili', nativeName: 'Kiswahili' },
  { code: 'ki', name: 'Kikuyu', nativeName: 'Kikuyu' }
];
`;
    fs.writeFileSync(outputPath, fallbackContent);
    console.log('✅ Created fallback languages file');
  }
};

generateLanguages();
