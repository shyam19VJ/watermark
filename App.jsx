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
import {loadEnv} from './src/config/credentials';

export default function App() {
  const [downloading, setDownloading] = useState(false);

  const watermarkText = 'IMG.LY';
  const watermarkImage = {
    uri: 'https://via.placeholder.com/300x200.png?text=Dummy+Image',
  };
  const videoUri = 'https://www.w3schools.com/html/mov_bbb.mp4';

  const uploadToCloudinary = async (
    fileUri,
    resourceType = 'video',
    cloudName,
    uploadPreset,
  ) => {
    const data = new FormData();
    data.append('file', {
      uri: fileUri,
      type: resourceType === 'video' ? 'video/mp4' : 'image/png',
      name: resourceType === 'video' ? 'video.mp4' : 'image.png',
    });
    data.append('upload_preset', uploadPreset);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      {method: 'POST', body: data},
    );
    const json = await res.json();
    if (!json.secure_url) {
      throw new Error('Upload failed');
    }
    return json;
  };

  const handleDownload = async () => {
    try {
      // Request storage permission for Android 13+ / legacy versions
      const hasPermission = await requestStoragePermission();
      console.log('hasPermission', hasPermission);

      if (!hasPermission) {
        return;
      }

      // load credentials from .env (or react-native-config if available)
      const {CLOUD_NAME, UPLOAD_PRESET} = await loadEnv();
      if (!CLOUD_NAME || !UPLOAD_PRESET) {
        Alert.alert(
          'Missing Credentials',
          'Cloudinary credentials not found. Please add them to .env or configure react-native-config.',
        );
        return;
      }

      setDownloading(true);
      Alert.alert('⏳ Uploading & Processing..');

      // Upload video & watermark image
      const videoData = await uploadToCloudinary(
        videoUri,
        'video',
        CLOUD_NAME,
        UPLOAD_PRESET,
      );
      const imageData = await uploadToCloudinary(
        watermarkImage.uri,
        'image',
        CLOUD_NAME,
        UPLOAD_PRESET,
      );

      // Apply watermark transformations
      const transformedUrl = videoData.secure_url.replace(
        '/upload/',
        `/upload/l_text:Arial_40_bold:${encodeURIComponent(
          watermarkText,
        )},co_rgb:FFFFFF,g_south_east,x_10,y_80/l_${
          imageData.public_id
        },w_0.2,g_north_west,x_10,y_10/`,
      );

      // Download file to device
      const path = RNFS.DownloadDirectoryPath + '/final_watermarked.mp4';
      const res = await RNFS.downloadFile({
        fromUrl: transformedUrl,
        toFile: path,
      }).promise;

      setDownloading(false);

      if (res.statusCode === 200) {
        Alert.alert('✅ Success', `Downloaded to: ${path}`);
      } else {
        Alert.alert('❌ Failed', 'Could not download video');
      }
    } catch (err) {
      setDownloading(false);
      Alert.alert('Error', err.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* Wrap the video in a view that won't block touches */}
      {/* make the whole video area non-interactive so it doesn't swallow touches on load */}
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
    // allow absolutely positioned children to stack above other siblings
    position: 'relative',
  },
  // ensure wrapper does not change layout but allows touches to pass to siblings
  videoWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  downloadButton: {
    // absolutely place the button so it's always on top and tappable
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
