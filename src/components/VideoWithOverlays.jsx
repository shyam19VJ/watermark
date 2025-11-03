import React from 'react';
import {View, Text, Image, StyleSheet} from 'react-native';
import Video from 'react-native-video';

export default function VideoWithOverlays({
  videoComponentProps,
  text,
  imageSrc,
  style,
}) {
  return (
    <View style={[styles.container, style]}>
      <Video
        {...videoComponentProps}
        style={styles.video}
        resizeMode="contain"
        controls
        paused={false}
        repeat
      />

      {/* Overlay text */}
      {text && (
        <Text style={styles.overlayText} pointerEvents="none">
          {text}
        </Text>
      )}

      {/* Overlay image */}
      {imageSrc && (
        <Image
          style={styles.overlayImage}
          source={imageSrc}
          resizeMode="contain"
          pointerEvents="none"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 300, // fixed height, adjust as needed
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  overlayText: {
    position: 'absolute', // minimal absolute use for overlay
    color: 'white',
    fontSize: 25,
    fontWeight: 'bold',
    bottom: 20,
    right: 20,
  },
  overlayImage: {
    position: 'absolute', // minimal absolute use for overlay
    top: 20,
    left: 20,
    width: 40,
    height: 40,
  },
});
