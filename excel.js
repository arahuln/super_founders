const readline = require("readline");
const fetch = require("node-fetch");
const XLSX = require("xlsx");  // Import the XLSX library
const fs = require("fs");

// Function to fetch specific restaurants and cafes with phone numbers
async function fetchRestaurantsWithPhoneNumbers(apiKey) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    // Taking address input from the user
    rl.question("Enter the address: ", async (address) => {
        address = address.trim(); // Remove leading/trailing spaces
        if (!address) {
            console.error("Address is required.");
            rl.close();
            return;
        }

        // Taking radius input from the user
        rl.question("Enter the search radius in meters (e.g., 1000): ", async (radiusInput) => {
            const radius = parseInt(radiusInput.trim());
            if (isNaN(radius) || radius <= 0) {
                console.error("Invalid radius. Please enter a positive number.");
                rl.close();
                return;
            }

            // Asking for the Excel filename
            rl.question("Enter the Excel filename (e.g., 'restaurants.xlsx'): ", async (excelFileName) => {
                if (!excelFileName) {
                    console.error("Excel filename is required.");
                    rl.close();
                    return;
                }

                try {
                    // Fetching coordinates based on address (Geocoding API)
                    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
                    const response = await fetch(geocodeUrl);
                    const data = await response.json();

                    if (data.results.length === 0) {
                        throw new Error("Address not found. Please check the input.");
                    }

                    const location = data.results[0].geometry.location;
                    const lat = location.lat;
                    const lng = location.lng;

                    console.log(`Coordinates: ${lat}, ${lng}`);

                    let allFoodDetails = [];
                    let nextPageToken = null;

                    // Loop to handle pagination and fetch all results
                    do {
                        let nearbySearchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&keyword=restaurant&key=${apiKey}`;
                        
                        // If there's a nextPageToken, include it in the URL to fetch the next page
                        if (nextPageToken) {
                            nearbySearchUrl += `&pagetoken=${nextPageToken}`;
                        }

                        const nearbyResponse = await fetch(nearbySearchUrl);
                        const nearbyData = await nearbyResponse.json();

                        // Fetch details for each place (name, address, phone number)
                        for (const place of nearbyData.results) {
                            const placeDetailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,rating&key=${apiKey}`;
                            const detailsResponse = await fetch(placeDetailsUrl);
                            const detailsData = await detailsResponse.json();

                            // Only add places with phone numbers
                            if (detailsData.result && detailsData.result.formatted_phone_number) {
                                allFoodDetails.push({
                                    name: detailsData.result.name,
                                    address: detailsData.result.formatted_address || "N/A",
                                    phone: detailsData.result.formatted_phone_number || "N/A",
                                    rating: detailsData.result.rating || "N/A",
                                });
                            }
                        }

                        // Check for the next page of results
                        nextPageToken = nearbyData.next_page_token;

                        // Wait a moment before sending the next request due to Google API's pagination delay
                        if (nextPageToken) {
                            console.log("Fetching next page of results...");
                            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
                        }

                    } while (nextPageToken); // Repeat until no nextPageToken is found

                    // If results are available, save to Excel
                    if (allFoodDetails.length === 0) {
                        console.log("No restaurants with phone numbers found in the specified radius.");
                    } else {
                        // Create Excel file with the data
                        const ws = XLSX.utils.json_to_sheet(allFoodDetails);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, "Restaurants");

                        // Save the Excel file
                        const excelFilePath = `${excelFileName}.xlsx`;
                        XLSX.writeFile(wb, excelFilePath);
                        console.log(`Excel file saved at ${excelFilePath}`);
                    }

                } catch (error) {
                    console.error(`Error: ${error.message}`);
                } finally {
                    rl.close(); // Ensure the readline interface is closed properly
                }
            });
        });
    });
}

// Example Usage
const apiKey = "AIzaSyDl1CEHBKnT354R_t63DlRV7ABBp2Siuyc"; // Replace with your Google API Key
fetchRestaurantsWithPhoneNumbers(apiKey);
