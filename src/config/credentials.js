import {Platform, Linking} from 'react-native';
import RNFS from 'react-native-fs';

const parseEnv = content => {
  const result = {};
  content.split(/\r?\n/).forEach(line => {
    const l = line.trim();
    if (!l || l.startsWith('#')) {
      return;
    }
    const idx = l.indexOf('=');
    if (idx === -1) {
      return;
    }
    const key = l.slice(0, idx).trim();
    const val = l.slice(idx + 1).trim();
    result[key] = val;
  });
  return result;
};

export const loadEnv = async () => {
  // Try react-native-config first (if installed)
  try {
    const RNConfig = require('react-native-config');
    if (RNConfig && (RNConfig.CLOUD_NAME || RNConfig.UPLOAD_PRESET)) {
      return {
        CLOUD_NAME: RNConfig.CLOUD_NAME,
        UPLOAD_PRESET: RNConfig.UPLOAD_PRESET,
      };
    }
  } catch (e) {
    // react-native-config not present — fall through to bundle read
  }

  try {
    let content = '';
    if (Platform.OS === 'android' && RNFS.readFileAssets) {
      // read bundled asset named ".env" (place .env in android/app/src/main/assets or root assets)
      content = await RNFS.readFileAssets('.env', 'utf8');
    } else if (Platform.OS === 'ios' && RNFS.MainBundlePath) {
      // On iOS, .env should be included in the app bundle (add to Xcode resources)
      const path = `${RNFS.MainBundlePath}/.env`;
      content = await RNFS.readFile(path, 'utf8');
    } else {
      // As a last resort attempt to read from DocumentDirectoryPath (useful during dev)
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
