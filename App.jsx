import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import RNFS from 'react-native-fs';

// --- Assuming these are defined in your project ---
import { requestStoragePermission } from './src/utils/permissions';
import { loadEnv } from './src/config/credentials';
import VideoWithOverlays from './src/components/VideoWithOverlays'; // Placeholder for your video viewer

// --- Cloudinary Upload Function with Enhanced Error Handling ---
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

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
  const res = await fetch(url, { method: 'POST', body: data });
  const json = await res.json();

  // Check for successful response and secure_url
  if (!res.ok || !json.secure_url) {
    console.error('Cloudinary Upload Failure Response:', json);
    const errorMsg = json.error ? json.error.message : 'Unknown Cloudinary upload error. Check Network/Credentials.';
    throw new Error(`Upload failed: ${errorMsg}`);
  }

  return json;
};
// -----------------------------------------------------------------

export default function App() {
  const [downloading, setDownloading] = useState(false);

  const watermarkText = 'IMG.LY';
  const watermarkImage = {
    uri: 'https://via.placeholder.com/300x200.png?text=Dummy+Image', // Dummy image URI
  };
  const videoUri = 'https://www.w3schools.com/html/mov_bbb.mp4'; // Sample video URI

  const handleDownload = async () => {
    try {
      // 1. Check Permissions
      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission Denied',
          'Storage access is required to save videos.'
        );
        return;
      }

      // 2. Load Credentials
      const { CLOUD_NAME, UPLOAD_PRESET } = await loadEnv();
      if (!CLOUD_NAME || !UPLOAD_PRESET) {
        Alert.alert(
          'Missing Credentials',
          'Cloudinary credentials not found. Please check your .env setup.',
        );
        return;
      }

      setDownloading(true);
      Alert.alert('⏳ Uploading & Processing..', 'Please wait for the video transformation.');

      // 3. Upload Assets to Cloudinary
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

      // 4. Construct Transformed URL
      // The transformation: [Text overlay, then Image overlay]
      const transformedUrl = videoData.secure_url.replace(
        '/upload/',
        `/upload/l_text:Arial_40_bold:${encodeURIComponent(
          watermarkText,
        )},co_rgb:FFFFFF,g_south_east,x_10,y_80/l_${imageData.public_id
        },w_0.2,g_north_west,x_10,y_10/`,
      );

      // inside handleDownload before RNFS.downloadFile
      console.log('Attempting to download from URL:', transformedUrl);

      // 5. Choose Platform-Specific Download Path
      const path =
        Platform.OS === 'android'
          ? `${RNFS.DownloadDirectoryPath}/final_watermarked.mp4`
          : `${RNFS.DocumentDirectoryPath}/final_watermarked.mp4`;

      console.log('Downloading transformed video from:', transformedUrl);
      console.log('Downloading to:', path);

      // 6. Download the Transformed Video
      // const res = await RNFS.downloadFile({
      //   fromUrl: transformedUrl,
      //   toFile: path,
      // }).promise;
      
      const res = await RNFS.downloadFile({
        fromUrl: transformedUrl,
        toFile: path,
        // Add an explicit timeout (e.g., 60 seconds)
        readTimeout: 60000,
        connectionTimeout: 30000,
      }).promise;

      setDownloading(false);

      if (res.statusCode === 200) {
        Alert.alert('✅ Success', `Video saved to:\n${path}`);
      } else {
        Alert.alert('❌ Failed', `Could not download video. Status: ${res.statusCode}`);
      }
    } catch (err) {
      setDownloading(false);
      console.error('Download process error:', err.message);
      Alert.alert('Error', err.message || 'Something went wrong during the process.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Placeholder for your Video component */}
      <View style={styles.videoWrapper} pointerEvents="none">
        <VideoWithOverlays
          videoComponentProps={{ source: { uri: videoUri } }}
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

// Styles remain the same
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