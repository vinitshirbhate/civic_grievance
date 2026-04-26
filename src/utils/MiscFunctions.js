import axios from "axios";

export const installPWA = () => {};

const PUNE_GEOFENCE = {
  minLat: 18.36,
  maxLat: 18.68,
  minLng: 73.68,
  maxLng: 74.02,
};

function isWithinPune(lat, lng) {
  return (
    lat >= PUNE_GEOFENCE.minLat &&
    lat <= PUNE_GEOFENCE.maxLat &&
    lng >= PUNE_GEOFENCE.minLng &&
    lng <= PUNE_GEOFENCE.maxLng
  );
}

function formatAddressFromNominatim(data) {
  const addr = data?.address || {};
  const locality = addr.suburb || addr.neighbourhood || addr.city_district || addr.city || "Pune";
  const road = addr.road || addr.amenity || addr.building || "";
  return road ? `${road}, ${locality}, Pune` : `${locality}, Pune`;
}

function formatAddressFromBigData(data) {
  const locality = data?.locality || data?.principalSubdivision || "Pune";
  const city = data?.city || "Pune";
  return `${locality}, ${city}`;
}

export const identifyLocation = async () => {
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });
    });

    const lat = Number(position.coords.latitude);
    const lng = Number(position.coords.longitude);

    if (!isWithinPune(lat, lng)) {
      throw new Error("Location outside Pune is currently not supported.");
    }

    let locationName = "Pune";
    try {
      const nominatim = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
      );
      locationName = formatAddressFromNominatim(nominatim.data);
    } catch (_error) {
      const fallback = await axios.get(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
      );
      locationName = formatAddressFromBigData(fallback.data);
    }

    return {
      name: locationName,
      lat,
      lng,
      city: "Pune",
      accuracy: position.coords.accuracy || null,
    };
  } catch (err) {
    throw new Error(err.message);
  }
};
