import {Platform, PermissionsAndroid, Alert, Linking} from 'react-native';

export const requestStoragePermission = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }

  const permissions = [
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE, // fallback for older versions
  ];

  if (Platform.Version >= 33) {
    // Android 13+ requires explicit media permissions
    permissions.push(
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
    );
  }

  // Check which permissions are missing
  const missing = [];
  for (const perm of permissions) {
    const hasPerm = await PermissionsAndroid.check(perm);
    if (!hasPerm) {
      missing.push(perm);
    }
  }

  if (missing.length === 0) {
    return true;
  }

  // Request only missing permissions
  const statuses = await PermissionsAndroid.requestMultiple(missing);

  // Check if any are permanently denied
  const blocked = Object.values(statuses).some(
    status => status === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
  );
  if (blocked) {
    Alert.alert(
      'Storage Permission Required',
      'Please enable storage permission in app settings',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Open Settings', onPress: () => Linking.openSettings()},
      ],
    );
    return false;
  }

  // Check if any are denied
  const denied = Object.values(statuses).some(
    status => status === PermissionsAndroid.RESULTS.DENIED,
  );
  return !denied;
};
