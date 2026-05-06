/**
 * A utility function to upload a file to Cloudinary.
 * This function is designed to be used in a client-side environment with Vite,
 * reading the Cloudinary configuration from environment variables.
 *
 * @param {File} file The file object to be uploaded (e.g., from an <input type="file"> element).
 * @returns {Promise<string>} A promise that resolves with the secure URL of the uploaded image.
 * @throws {Error} Throws an error if the upload fails or if the required environment variables are not set.
 */
export async function uploadToCloudinary(file) {
  // Get Cloudinary credentials from environment variables
  // const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  // const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  // Check if the required environment variables are set
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    console.error("Cloudinary credentials are not set in the environment variables.");
    throw new Error("Cloudinary configuration is missing.");
  }

  // The Cloudinary upload endpoint URL
  const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  // Create a FormData object to hold the file and upload preset
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  try {
    // Make the POST request to the Cloudinary API
    const response = await fetch(UPLOAD_URL, {
      method: "POST",
      body: formData,
    });

    // Check if the request was successful
    if (!response.ok) {
      throw new Error(`Upload failed with status: ${response.status}`);
    }

    // Parse the JSON response
    const data = await response.json();

    // The secure_url is the HTTPS URL of the uploaded image
    return data.secure_url;

  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    // Re-throw the error so it can be caught by the calling function
    throw error;
  }
}
