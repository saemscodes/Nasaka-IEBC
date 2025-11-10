#!/usr/bin/env node

// ES module script for generating language files
import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      parsed[key] = value || true;
    }
  }
  
  return parsed;
}

function parseList(val) {
  if (!val) return [];
  return val.split(',').map(s => s.trim()).filter(Boolean);
}

// Simple translation stub - replace with actual translation service
function translateText(text, targetLang) {
  // This is a placeholder - in production, you'd integrate with a translation API
  console.log(`Would translate "${text.substring(0, 30)}..." to ${targetLang}`);
  
  // Return the original text for now, but mark it as needing translation
  return `${text} [TO TRANSLATE: ${targetLang.toUpperCase()}]`;
}

function translateObject(obj, targetLang, currentPath = '') {
  const translated = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newPath = currentPath ? `${currentPath}.${key}` : key;
    
    if (typeof value === 'string') {
      translated[key] = translateText(value, targetLang);
    } else if (typeof value === 'object' && value !== null) {
      translated[key] = translateObject(value, targetLang, newPath);
    } else {
      translated[key] = value;
    }
  }
  
  return translated;
}

async function main() {
  try {
    const args = parseArgs();
    const srcArg = args.src || 'src/locales/en/nasaka.json';
    const langsArg = args.langs || process.env.TARGET_LANGS || 'sw,ki,luo,taita,kam';
    const targetLangs = parseList(langsArg);

    console.log('🚀 Generating language files...');
    console.log(`📁 Source: ${srcArg}`);
    console.log(`🌐 Target languages: ${targetLangs.join(', ')}`);

    const srcPath = path.resolve(process.cwd(), srcArg);

    // Check if source file exists
    if (!existsSync(srcPath)) {
      console.error(`❌ Source file not found: ${srcPath}`);
      console.log('💡 Please check the file path and try again');
      process.exit(1);
    }

    // Read source JSON
    const rawData = await readFile(srcPath, 'utf8');
    let sourceJson;
    
    try {
      sourceJson = JSON.parse(rawData);
    } catch (parseError) {
      console.error(`❌ Failed to parse JSON from ${srcPath}:`, parseError.message);
      process.exit(1);
    }

    // Generate files for each target language
    for (const lang of targetLangs) {
      const destDir = path.resolve(process.cwd(), `src/locales/${lang}`);
      const destPath = path.join(destDir, 'nasaka.json');
      
      try {
        // Create directory if it doesn't exist
        await mkdir(destDir, { recursive: true });
        
        // Check if target file already exists
        let existingData = {};
        if (existsSync(destPath)) {
          try {
            const existingRaw = await readFile(destPath, 'utf8');
            existingData = JSON.parse(existingRaw);
            console.log(`📖 Found existing translations for ${lang}`);
          } catch (e) {
            console.log(`🆕 Creating new translation file for ${lang}`);
          }
        } else {
          console.log(`🆕 Creating new translation file for ${lang}`);
        }

        // Merge existing translations with new structure
        // For now, we'll just use the source structure with translation markers
        // In a real scenario, you'd want to preserve existing translations
        const translatedData = translateObject(sourceJson, lang);
        
        // Write the file
        await writeFile(destPath, JSON.stringify(translatedData, null, 2), 'utf8');
        console.log(`✅ Generated ${destPath}`);
        
      } catch (error) {
        console.error(`❌ Failed to generate ${lang}:`, error.message);
      }
    }

    console.log('🎉 Language file generation completed!');
    console.log('💡 Next steps:');
    console.log('   - Review the generated files in src/locales/');
    console.log('   - Replace translation markers with actual translations');
    console.log('   - Add the language to src/i18n/languageRegistry.ts');
    
  } catch (error) {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
