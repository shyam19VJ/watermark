import {Platform} from 'react-native';
import RNFS from 'react-native-fs';
let Config = {}; // fallback if module not installed

// Safely import react-native-config (wrapped in try/catch)
try {
  Config = require('react-native-config').default || require('react-native-config');
} catch (e) {
  console.log('react-native-config not installed, using .env fallback');
}

// Helper to parse key=value lines
const parseEnv = content => {
  const result = {};
  content.split(/\r?\n/).forEach(line => {
    const l = line.trim();
    if (!l || l.startsWith('#')) return;
    const idx = l.indexOf('=');
    if (idx === -1) return;
    const key = l.slice(0, idx).trim();
    const val = l.slice(idx + 1).trim();
    result[key] = val;
  });
  return result;
};

export const loadEnv = async () => {
  // First try environment variables from react-native-config
  if (Config && (Config.CLOUD_NAME || Config.UPLOAD_PRESET)) {
    return {
      CLOUD_NAME: Config.CLOUD_NAME,
      UPLOAD_PRESET: Config.UPLOAD_PRESET,
    };
  }

  // Fallback to reading .env manually
  try {
    let content = '';
    if (Platform.OS === 'android' && RNFS.readFileAssets) {
      // Read from android/app/src/main/assets/.env
      content = await RNFS.readFileAssets('.env', 'utf8');
    } else if (Platform.OS === 'ios' && RNFS.MainBundlePath) {
      // Read from bundled iOS resource
      const path = `${RNFS.MainBundlePath}/.env`;
      content = await RNFS.readFile(path, 'utf8');
    } else {
      // Fallback for dev builds
      const path = `${RNFS.DocumentDirectoryPath}/.env`;
      content = await RNFS.readFile(path, 'utf8');
    }

    const parsed = parseEnv(content);
    return {
      CLOUD_NAME: parsed.CLOUD_NAME || '',
      UPLOAD_PRESET: parsed.UPLOAD_PRESET || '',
    };
  } catch (err) {
    console.warn('Could not load .env from bundle:', err);
    return {CLOUD_NAME: '', UPLOAD_PRESET: ''};
  }
};
