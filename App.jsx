import React, {useState} from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import RNFS from 'react-native-fs';
import VideoWithOverlays from './src/components/VideoWithOverlays';
import {requestStoragePermission} from './src/utils/permissions';

// ---------- Helper: build Cloudinary URL from a transformation array ----------
// This helper accepts the same "transformation" array shape you showed:
// [{ quality:'auto', width:640, height:360, crop:'fit' }, { fetch_format:'auto' }, ...]
// It converts that into a Cloudinary-style transformation string.
const buildCloudinaryUrl = (cloudName, publicId, options = {}) => {
  const base = `https://res.cloudinary.com/${cloudName}/video/upload/`;
  const {transformation = []} = options;

  const segments = transformation
    .map(t => {
      // t is an object with keys like quality, width, height, crop, fetch_format, video_codec, audio_codec, overlay etc.
      // We'll build a short segment string from known keys.
      const parts = [];

      // Basic size / crop / quality
      if (t.quality) {
        // Cloudinary uses q_auto or q_XX
        const q =
          typeof t.quality === 'string' && t.quality.startsWith('auto')
            ? `q_${t.quality}`
            : `q_${t.quality}`;
        parts.push(q);
      }
      if (t.width) {
        parts.push(`w_${t.width}`);
      }
      if (t.height) {
        parts.push(`h_${t.height}`);
      }
      if (t.crop) {
        parts.push(`c_${t.crop}`);
      }

      // format forcing
      if (t.fetch_format) {
        parts.push(`f_${t.fetch_format}`);
      }

      // video/audio codec forcing
      if (t.video_codec) {
        // Allow syntax like 'h264:baseline' or 'h264'
        const vc = t.video_codec.includes(':')
          ? `vc_${t.video_codec.replace(':', ':')}`
          : `vc_${t.video_codec}`;
        parts.push(vc);
      }
      if (t.audio_codec) {
        parts.push(`ac_${t.audio_codec}`);
      }

      // overlay handling (text or image)
      if (t.overlay) {
        // text overlay object { font_family, font_size, font_weight, text }
        if (typeof t.overlay === 'object' && t.overlay.text) {
          const font = t.overlay.font_family || 'Arial';
          const size = t.overlay.font_size || 40;
          const weight = t.overlay.font_weight
            ? `_${t.overlay.font_weight}`
            : '';
          const text = encodeURIComponent(t.overlay.text);
          parts.push(`l_text:${font}_${size}${weight}:${text}`);
        } else if (typeof t.overlay === 'string') {
          // image overlay public id
          const pub = encodeURIComponent(t.overlay);
          parts.push(`l_${pub}`);
        }
      }

      // color (co_hex) - Cloudinary uses co_rgb:FFFFFF
      if (t.color) {
        let color = t.color.replace('#', '');
        parts.push(`co_rgb:${color}`);
      }

      // gravity, x, y
      if (t.gravity) {
        parts.push(`g_${t.gravity}`);
      }
      if (t.x || t.x === 0) {
        parts.push(`x_${t.x}`);
      }
      if (t.y || t.y === 0) {
        parts.push(`y_${t.y}`);
      }

      // width as relative (0.2) -> w_0.2
      if (typeof t.width === 'number' && t.width > 0 && t.width < 1) {
        // when passed as decimal for overlays we want 'w_0.2'
        parts.push(`w_${t.width}`);
      }

      return parts.join(',');
    })
    .filter(Boolean);

  // join segments with '/'
  const transformString = segments.join('/');

  // final url
  return `${base}${transformString}/${publicId}`;
};

// ---------- File verification helper ----------
const verifyFile = async path => {
  try {
    const exists = await RNFS.exists(path);
    if (!exists) {
      return {ok: false, reason: 'not_exists'};
    }
    const stat = await RNFS.stat(path);
    if (!stat.size || Number(stat.size) === 0) {
      return {ok: false, reason: 'zero_size'};
    }
    return {ok: true, size: Number(stat.size)};
  } catch (e) {
    return {ok: false, reason: 'stat_error', error: e.message};
  }
};

export default function App() {
  const [downloading, setDownloading] = useState(false);

  // Cloudinary credentials directly in component
  const CLOUD_NAME = 'dtbko5q4m';
  const UPLOAD_PRESET = 'my_preset_name';

  const watermarkText = 'IMG.LY';
  const watermarkImage = {
    uri: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
  };
  const videoUri = 'https://www.w3schools.com/html/mov_bbb.mp4';

  const uploadToCloudinary = async (fileUri, resourceType = 'video') => {
    try {
      const isRemoteUrl = fileUri.startsWith('http');

      // Validate URL format
      if (isRemoteUrl) {
        try {
          new URL(fileUri);
        } catch (e) {
          throw new Error(`Invalid URL format: ${fileUri}`);
        }
      }

      const data = new FormData();

      if (resourceType === 'image' && isRemoteUrl) {
        // For remote images, we can send the remote URL directly to Cloudinary
        data.append('file', encodeURI(fileUri));
      } else {
        data.append(
          'file',
          isRemoteUrl
            ? fileUri
            : {
                uri: fileUri,
                type: resourceType === 'video' ? 'video/mp4' : 'image/png',
                name: resourceType === 'video' ? 'video.mp4' : 'image.png',
              },
        );
      }

      data.append('upload_preset', UPLOAD_PRESET);

      const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
      console.log(`Uploading ${resourceType} from:`, fileUri);

      // Add timeout and better error handling for fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const res = await fetch(url, {
          method: 'POST',
          body: data,
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const json = await res.json();

        if (!res.ok) {
          console.error(`Upload failed for ${resourceType}:`, json);
          throw new Error(
            json.error?.message || `HTTP error! status: ${res.status}`,
          );
        }

        if (!json.secure_url || !json.public_id) {
          throw new Error(
            'Upload succeeded but no secure_url/public_id returned',
          );
        }

        console.log(`${resourceType} upload successful:`, json.secure_url);
        return json;
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          throw new Error('Upload timed out');
        }
        throw fetchError;
      }
    } catch (error) {
      console.error(`Upload error for ${resourceType}:`, error);
      throw new Error(`Failed to upload ${resourceType}: ${error.message}`);
    }
  };

  const headCheck = async url => {
    try {
      const resp = await fetch(url, {method: 'HEAD'});
      return {ok: resp.ok, status: resp.status, headers: resp.headers};
    } catch (err) {
      return {ok: false, error: err.message};
    }
  };

  const handleDownload = async () => {
    try {
      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission required',
          'Storage permission is required to download the file.',
        );
        return;
      }

      setDownloading(true);
      Alert.alert('⏳ Uploading & Processing...');

      // Upload video & watermark image
      const videoData = await uploadToCloudinary(videoUri, 'video');
      const imageData = await uploadToCloudinary(watermarkImage.uri, 'image');

      // Build Cloudinary transformations using the array style you requested
      const optimizedVideoUrl = buildCloudinaryUrl(
        CLOUD_NAME,
        videoData.public_id,
        {
          transformation: [
            {quality: 'auto', width: 640, height: 360, crop: 'fit'},
            {fetch_format: 'auto'},
            // Text overlay as a separate transformation segment
            {
              overlay: {
                font_family: 'Arial',
                font_size: 40,
                font_weight: 'bold',
                text: watermarkText,
              },
              color: '#FFFFFF',
              gravity: 'south_east',
              x: 10,
              y: 80,
            },
            // Image overlay (use the uploaded image public_id)
            {
              overlay: imageData.public_id,
              width: 0.2,
              gravity: 'north_west',
              x: 10,
              y: 10,
            },
            // Force codecs + mp4 for compatibility
            {
              video_codec: 'h264:baseline',
              audio_codec: 'aac',
              fetch_format: 'mp4',
            },
          ],
        },
      );

      console.log('Optimized Cloudinary URL:', optimizedVideoUrl);

      // Quick HEAD check
      const head = await headCheck(optimizedVideoUrl);
      console.log('HEAD check:', head);
      if (!head.ok) {
        setDownloading(false);
        Alert.alert(
          'Download failed',
          `Remote HEAD check failed (status: ${
            head.status || 'error'
          }). URL may be invalid or unauthorized.`,
        );
        return;
      }

      // Download file to device
      const path = RNFS.DownloadDirectoryPath + '/final_watermarked.mp4';

      const downloadOptions = {
        fromUrl: optimizedVideoUrl,
        toFile: path,
        background: true,
        discretionary: true,
        progressDivider: 10,
        begin: res => console.log('Download begin', res),
        progress: res => {
          try {
            const pct = Math.floor(
              (res.bytesWritten / res.contentLength) * 100,
            );
            console.log(`Download progress: ${pct}%`);
          } catch (e) {
            // ignore divide by zero
          }
        },
      };

      const dl = RNFS.downloadFile(downloadOptions);
      const res = await dl.promise;

      setDownloading(false);

      if (res.statusCode === 200 || res.statusCode === 201) {
        const check = await verifyFile(path);
        if (!check.ok) {
          Alert.alert(
            'Download failed',
            `File saved but verification failed: ${check.reason}`,
          );
          return;
        }

        Alert.alert(
          '✅ Success',
          `Downloaded to: ${path} (size: ${check.size} bytes)`,
        );
      } else {
        console.warn('RNFS download failed', res);
        Alert.alert(
          '❌ Failed',
          `Could not download video (HTTP ${res.statusCode}).`,
        );
      }
    } catch (err) {
      setDownloading(false);
      console.error('Download process error:', err);
      Alert.alert('Error', err.message || 'Unknown error during download.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.videoWrapper} pointerEvents="none">
        <VideoWithOverlays
          videoComponentProps={{source: {uri: videoUri}}}
          text={watermarkText}
          imageSrc={watermarkImage}
        />
      </View>

      <TouchableOpacity
        style={[styles.downloadButton, downloading && styles.disabledButton]}
        onPress={handleDownload}
        disabled={downloading}
        pointerEvents="auto">
        <Text style={styles.buttonText}>
          {downloading ? 'Processing...' : 'Download Watermarked Video'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#fff',
    position: 'relative',
  },
  videoWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  downloadButton: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    zIndex: 9999,
    elevation: 20,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
